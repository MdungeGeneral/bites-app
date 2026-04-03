Place your video files here, organised into sub-folders by topic name.

Example structure:

  public/videos/
  └── biology-101/
      ├── cell-division.mp4
      └── dna-replication.mp4
  └── world-history/
      └── ww2-overview.mp4

EduBites will auto-discover every .mp4 / .webm / .mov file and build
the playlist from them. No code changes needed — just drop files in and
refresh the page.

For production, upload files to your Cloudflare R2 bucket at:
  r2://<bucket>/<topic-name>/<video-name>.mp4
and run: python scripts/upload_to_r2.py <topic-name> <video-file.mp4>
or run:  python scripts/upload_to_r2.py "public\videos\<topic folder name>"
