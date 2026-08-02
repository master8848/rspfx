import { Version } from '@microsoft/sp-core-library';
import { greeting } from './dep.js';
import styles from './styles.mod.scss';
import htmlTemplate from './template.html';
import * as strings from 'XxxWebPartStrings';

void import('./lazy.js');

export interface ITestWebPartProps {
  description: string;
}

export class TestWebPart {
  public render(): void {
    const version = Version.parse('1.0.0').toString();
    const el = document.createElement('div');
    el.className = styles.title ?? '';
    el.textContent = `${greeting} ${version} ${strings.Title}`;
    el.setAttribute('data-template', htmlTemplate);
    document.body.appendChild(el);
  }
}
