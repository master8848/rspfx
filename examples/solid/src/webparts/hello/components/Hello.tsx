import type { JSX } from 'solid-js';

export interface IHelloProps {
  description: string;
}

const FEATURES = ['Vite / Rsbuild / Rspack builds', 'Manifest generation', 'SPFx-compatible output', 'No webpack, no gulp'];

const cardStyle: JSX.CSSProperties = {
  'max-width': '480px',
  margin: '24px auto',
  padding: '24px',
  border: '1px solid #e1dfdd',
  'border-radius': '6px',
  'box-shadow': '0 2px 8px rgba(0, 0, 0, 0.08)',
  'font-family': '"Segoe UI", sans-serif'
};

const titleStyle: JSX.CSSProperties = {
  margin: '0 0 12px 0',
  color: '#323130',
  'font-size': '20px'
};

const listStyle: JSX.CSSProperties = {
  margin: '0',
  'padding-left': '20px',
  color: '#605e5c',
  'line-height': '1.8'
};

export default function Hello(props: IHelloProps): JSX.Element {
  return (
    <div class="hello-card" style={cardStyle}>
      <h2 style={titleStyle}>{props.description}</h2>
      <ul style={listStyle}>
        {FEATURES.map((feature) => (
          <li>{feature}</li>
        ))}
      </ul>
    </div>
  );
}
