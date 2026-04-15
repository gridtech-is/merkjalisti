import { Octokit } from '@octokit/rest';

export interface FileContent {
  content: string;
  sha: string;
}

export class GitHubApi {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(token: string, owner: string, repo: string) {
    this.octokit = new Octokit({ auth: token });
    this.owner = owner;
    this.repo = repo;
  }

  async readFile(path: string): Promise<FileContent> {
    const response = await this.octokit.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path,
    });
    const data = response.data;
    if (Array.isArray(data) || data.type !== 'file') {
      throw new Error(`${path} is not a file`);
    }
    const raw = atob(data.content.replace(/\n/g, ''));
    const content = decodeURIComponent(
      Array.from(raw)
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return { content, sha: data.sha };
  }

  async readJson<T>(path: string): Promise<{ data: T; sha: string }> {
    const { content, sha } = await this.readFile(path);
    return { data: JSON.parse(content) as T, sha };
  }

  async writeJson<T>(
    path: string,
    data: T,
    sha: string | null,
    message: string
  ): Promise<string> {
    // eslint-disable-next-line
    const content = btoa(encodeURIComponent(JSON.stringify(data, null, 2)).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
    const response = await this.octokit.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      path,
      message,
      content,
      ...(sha ? { sha } : {}),
    });
    return response.data.content?.sha ?? '';
  }

  async listDirectory(path: string): Promise<string[]> {
    const response = await this.octokit.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path,
    });
    const data = response.data;
    if (!Array.isArray(data)) return [];
    return data.map(item => item.name);
  }
}
