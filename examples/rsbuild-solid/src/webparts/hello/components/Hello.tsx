import type { JSX } from 'solid-js';

export interface IHelloProps {
  description: string;
}

export default function Hello(props: IHelloProps): JSX.Element {
  return (
    <div class="card" style={cardStyle}>
      <h2 style={titleStyle}>{props.description}</h2>
      <p style={descriptionStyle}>
        Change the Description property in the property pane to update this title.
      </p>
    </div>
  );
}

const cardStyle = {
  'max-width': '480px',
  margin: '24px auto',
  padding: '24px',
  border: '1px solid #e1dfdd',
  'border-radius': '6px',
  'box-shadow': '0 2px 8px rgba(0, 0, 0, 0.08)',
  'font-family': '"Segoe UI", sans-serif'
};
const titleStyle = {
  margin: '0 0 12px 0',
  color: '#323130',
  'font-size': '20px'
};
const descriptionStyle = {
  margin: '0',
  color: '#605e5c',
  'font-size': '14px'
};
