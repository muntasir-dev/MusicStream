interface GitHubFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url?: string;
  size?: number;
}

interface GitHubContent {
  name: string;
  path: string;
  type: string;
  download_url: string | null;
  size: number;
}

export class GitHubService {
  private static readonly AUDIO_EXTENSIONS = [
    '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma'
  ];

  static parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) return null;
    
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, '')
    };
  }

  static async fetchRepositoryContents(owner: string, repo: string, path: string = ''): Promise<GitHubContent[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data : [data];
    } catch (error) {
      console.error('Error fetching repository contents:', error);
      throw error;
    }
  }

  static async scanRepositoryStructure(owner: string, repo: string): Promise<{
    playlists: Array<{
      name: string;
      path: string;
      songs: Array<{
        name: string;
        path: string;
        downloadUrl: string;
        size: number;
      }>;
    }>;
  }> {
    const playlists: Array<{
      name: string;
      path: string;
      songs: Array<{
        name: string;
        path: string;
        downloadUrl: string;
        size: number;
      }>;
    }> = [];

    try {
      // Get root contents
      const rootContents = await this.fetchRepositoryContents(owner, repo);
      
      // Find directories (potential playlists)
      const directories = rootContents.filter(item => item.type === 'dir');
      
      for (const dir of directories) {
        const songs: Array<{
          name: string;
          path: string;
          downloadUrl: string;
          size: number;
        }> = [];

        try {
          // Get contents of each directory
          const dirContents = await this.fetchRepositoryContents(owner, repo, dir.path);
          
          // Find audio files
          const audioFiles = dirContents.filter(item => 
            item.type === 'file' && 
            this.AUDIO_EXTENSIONS.some(ext => 
              item.name.toLowerCase().endsWith(ext)
            )
          );

          // Add audio files to songs array
          for (const file of audioFiles) {
            if (file.download_url) {
              songs.push({
                name: this.extractSongTitle(file.name),
                path: file.path,
                downloadUrl: file.download_url,
                size: file.size || 0
              });
            }
          }

          // Only add playlist if it has songs
          if (songs.length > 0) {
            playlists.push({
              name: this.formatPlaylistName(dir.name),
              path: dir.path,
              songs
            });
          }
        } catch (error) {
          console.warn(`Error scanning directory ${dir.path}:`, error);
          continue;
        }
      }

      return { playlists };
    } catch (error) {
      console.error('Error scanning repository structure:', error);
      throw error;
    }
  }

  private static extractSongTitle(filename: string): string {
    // Remove file extension and clean up the title
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    
    // Replace underscores and hyphens with spaces
    const cleaned = nameWithoutExt.replace(/[_-]/g, ' ');
    
    // Capitalize first letter of each word
    return cleaned.replace(/\b\w/g, l => l.toUpperCase());
  }

  private static formatPlaylistName(dirname: string): string {
    // Replace underscores and hyphens with spaces
    const cleaned = dirname.replace(/[_-]/g, ' ');
    
    // Capitalize first letter of each word
    return cleaned.replace(/\b\w/g, l => l.toUpperCase());
  }

  static generateUniqueLink(owner: string, repo: string, filePath: string): string {
    // Create a unique shareable link for the song
    const encoded = btoa(`${owner}/${repo}/${filePath}`);
    return `${window.location.origin}/play/${encoded}`;
  }

  static async estimateAudioDuration(url: string): Promise<number> {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.addEventListener('loadedmetadata', () => {
        resolve(Math.floor(audio.duration) || 180); // Default to 3 minutes if can't determine
      });
      audio.addEventListener('error', () => {
        resolve(180); // Default duration on error
      });
      audio.src = url;
    });
  }
}