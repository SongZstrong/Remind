import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
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
            fontSize: 28,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: '#d4af37',
            marginBottom: 24,
          }}
        >
          Remind
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.1,
            maxWidth: 920,
            marginBottom: 24,
          }}
        >
          Free Secure Online Markdown Editor
        </div>
        <div
          style={{
            fontSize: 32,
            lineHeight: 1.4,
            maxWidth: 920,
            color: '#c7cbd2',
          }}
        >
          Browser-based private notebook with encrypted notes.
        </div>
      </div>
    ),
    size
  );
}
