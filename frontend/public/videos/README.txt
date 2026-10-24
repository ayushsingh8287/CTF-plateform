OPTIONAL CINEMATIC BACKGROUND VIDEO
===================================

The site already ships with a built-in animated Neon Tokyo scene (drawn on a
canvas, no files needed). If you also want real footage, drop a clip here and
it fades in over the scene automatically. If the files are missing or fail to
play, the animated scene simply stays. Nothing else to configure.

Expected file names (set in client/src/config.js):
  neon-tokyo.mp4          required for the video layer (H.264)
  neon-tokyo.webm         optional, smaller (VP9)
  neon-tokyo-poster.jpg   optional first-frame still

1. FIND A CLIP (free, commercial use, no attribution required)
   - https://www.pexels.com/search/videos/tokyo%20night/
   - https://pixabay.com/videos/search/neon%20city/
   Good searches: "tokyo night rain", "neon street", "cyberpunk city".
   Pick a landscape clip, 10 to 30 seconds. Check the licence on the page.
   Download from your own browser (the build sandbox cannot reach these sites).

2. ENCODE IT (needs ffmpeg). Replace input.mp4 with your downloaded file.
   Target: 1080p max, no audio, small (aim for under 8 MB).

   MP4 (H.264):
     ffmpeg -i input.mp4 -an -vf "scale=-2:1080,fps=30" \
       -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p \
       -movflags +faststart neon-tokyo.mp4

   WebM (VP9, optional):
     ffmpeg -i input.mp4 -an -vf "scale=-2:1080,fps=30" \
       -c:v libvpx-vp9 -crf 34 -b:v 0 neon-tokyo.webm

   Poster still (optional):
     ffmpeg -i neon-tokyo.mp4 -frames:v 1 -q:v 3 neon-tokyo-poster.jpg

   Make it loop cleanly (optional crossfade is not needed; the site loops it).

3. REBUILD
     npm run build
     npm start

NOTES
- The server's Content-Security-Policy is default-src 'self', so the video must
  be a local file in this folder. Do not link remote video URLs.
- The video is muted and loaded about a second after the scene paints. It is
  skipped for visitors with "reduce motion" or Data Saver on, and the on-page
  "Pause motion" button stops it.
- To disable the video layer completely, set BG_VIDEO = "" in config.js.
