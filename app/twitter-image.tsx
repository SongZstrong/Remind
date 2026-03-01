import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '64px',
          background:
            'radial-gradient(circle at top right, #4a3d16 0%, #2b2b2b 38%, #1e1e1e 100%)',
          color: '#d7dae0',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 24,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: '#d4af37',
            marginBottom: 20,
          }}
        >
          Remind
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.1,
            maxWidth: 900,
            marginBottom: 20,
          }}
        >
          Free Secure Markdown Notebook
        </div>
        <div
          style={{
            fontSize: 30,
            lineHeight: 1.35,
            maxWidth: 900,
            color: '#c7cbd2',
          }}
        >
          Online Markdown reading and editing in your browser.
        </div>
      </div>
    ),
    size
  );
}
