import type { CSSProperties, JSX } from 'preact';

export interface IHelloProps {
  description: string;
}

const FEATURES = ['Rspack-powered builds', 'Manifest generation', 'SPFx-compatible output', 'No webpack, no gulp'];

const cardStyle: CSSProperties = {
  maxWidth: '480px',
  margin: '24px auto',
  padding: '24px',
  border: '1px solid #e1dfdd',
  borderRadius: '6px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  fontFamily: '"Segoe UI", sans-serif'
};

const titleStyle: CSSProperties = {
  margin: '0 0 12px 0',
  color: '#323130',
  fontSize: '20px'
};

const listStyle: CSSProperties = {
  margin: '0',
  paddingLeft: '20px',
  color: '#605e5c',
  lineHeight: '1.8'
};

export default function Hello(props: IHelloProps): JSX.Element {
  return (
    <div className="hello-card" style={cardStyle}>
      <h2 style={titleStyle}>{props.description}</h2>
      <ul style={listStyle}>
        {FEATURES.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
    </div>
  );
}
