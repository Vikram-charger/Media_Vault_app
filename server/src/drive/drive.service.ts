import { ForbiddenException, Injectable } from '@nestjs/common';
import { google, drive_v3 } from 'googleapis';
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

const SCOPE = ['https://www.googleapis.com/auth/drive.file'];
const FOLDER_NAME = 'MediaVault';

@Injectable()
export class DriveService {
  private auth: InstanceType<typeof google.auth.OAuth2>;
  private drive: drive_v3.Drive;
  private tokenFile = process.env.TOKEN_FILE ?? './data/drive-token.json';
  private _folderId?: string;

  constructor() {
    this.auth = new google.auth.OAuth2(
      process.env.G_CLIENT_ID,
      process.env.G_CLIENT_SECRET,
      process.env.OAUTH_REDIRECT_URI,
    );
    const rt = this.loadToken();
    if (rt) this.auth.setCredentials({ refresh_token: rt });
    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }

  /* ---------- token handling ---------- */

  private loadToken(): string | undefined {
    try {
      return JSON.parse(readFileSync(this.tokenFile, 'utf8')).refresh_token;
    } catch {
      return process.env.G_REFRESH_TOKEN; // optional fallback
    }
  }

  authUrl() {
    return this.auth.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // forces Google to return a refresh token
      scope: SCOPE,
    });
  }

  async saveFromCode(code: string) {
    const { tokens } = await this.auth.getToken(code);
    if (!tokens.refresh_token) {
      throw new Error('No refresh token returned by Google');
    }
    mkdirSync(dirname(this.tokenFile), { recursive: true });
    writeFileSync(this.tokenFile, JSON.stringify({ refresh_token: tokens.refresh_token }));
    this.auth.setCredentials(tokens);
    this._folderId = undefined;
  }

  async status() {
    const r = await this.drive.about.get({ fields: 'user(emailAddress)' });
    return { connected: true, email: r.data.user?.emailAddress };
  }

  /* ---------- folder ---------- */

  // The drive.file scope only sees files this app created,
  // so the app creates (or finds) its own folder.
  async folderId() {
    if (this._folderId) return this._folderId;
    const q = `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`;
    const r = await this.drive.files.list({ q, fields: 'files(id)' });
    this._folderId =
      r.data.files?.[0]?.id ??
      (
        await this.drive.files.create({
          requestBody: { name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
          fields: 'id',
        })
      ).data.id!;
    return this._folderId;
  }

  private async assertInFolder(id: string) {
    const meta = await this.drive.files.get({ fileId: id, fields: 'parents' });
    if (!meta.data.parents?.includes(await this.folderId())) {
      throw new ForbiddenException();
    }
  }

  /* ---------- media ---------- */

  async list() {
    const folder = await this.folderId();
    const files: drive_v3.Schema$File[] = [];
    let pageToken: string | undefined;
    do {
      const r = await this.drive.files.list({
        q: `'${folder}' in parents and trashed=false and (mimeType contains 'image/' or mimeType contains 'video/')`,
        fields: 'nextPageToken, files(id,name,mimeType,size,createdTime)',
        orderBy: 'createdTime desc',
        pageSize: 1000,
        pageToken,
      });
      files.push(...(r.data.files ?? []));
      pageToken = r.data.nextPageToken ?? undefined;
    } while (pageToken);
    return files;
  }

  async upload(name: string, mimeType: string, path: string) {
    const r = await this.drive.files.create({
      requestBody: { name, parents: [await this.folderId()] },
      media: { mimeType, body: createReadStream(path) },
      fields: 'id,name,mimeType',
    });
    return r.data;
  }

  async stream(id: string, range?: string) {
    await this.assertInFolder(id);
    return this.drive.files.get(
      { fileId: id, alt: 'media' },
      { responseType: 'stream', headers: range ? { Range: range } : {} },
    );
  }

  async delete(id: string) {
    await this.assertInFolder(id);
    await this.drive.files.delete({ fileId: id });
  }
}