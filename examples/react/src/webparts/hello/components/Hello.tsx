import type { CSSProperties, JSX } from 'react';

export interface IHelloProps {
  description: string;
  userDisplayName: string;
  userEmail: string | undefined;
  userLoginName: string | undefined;
  siteUrl: string;
  webTitle: string;
  spAvailable: boolean;
}

const FEATURES = ['Rspack-powered builds', 'Manifest generation', 'SPFx-compatible output', 'No webpack, no gulp'];

const cardStyle: CSSProperties = {
  maxWidth: 480,
  margin: '24px auto',
  padding: 24,
  border: '1px solid #e1dfdd',
  borderRadius: 6,
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  fontFamily: '"Segoe UI", sans-serif'
};

const titleStyle: CSSProperties = {
  margin: '0 0 12px 0',
  color: '#323130',
  fontSize: 20
};

const statusStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  marginBottom: 16,
  borderRadius: 4,
  fontSize: 13,
  color: '#107c10',
  backgroundColor: '#e8ffea'
};

const dotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: '#107c10'
};

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 20,
  color: '#605e5c',
  lineHeight: 1.8
};

export default function Hello(props: IHelloProps): JSX.Element {
  return (
    <div className="hello-card" style={cardStyle}>
      <div style={statusStyle}>
        <span style={dotStyle} />
        <span>
          Signed in as <strong>{props.userDisplayName || 'Guest'}</strong>
          {props.userEmail ? ` (${props.userEmail})` : ''} —{' '}
          {props.spAvailable ? 'SharePoint object ready' : 'SharePoint object unavailable'}
        </span>
      </div>
      <h2 style={titleStyle}>{props.description}</h2>
      <ul style={listStyle}>
        {FEATURES.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <p style={{ marginTop: 12, fontSize: 12, color: '#605e5c' }}>
        Site: {props.webTitle} ({props.siteUrl}) · SP user: {props.userLoginName ?? 'n/a'}
      </p>
    </div>
  );
}
