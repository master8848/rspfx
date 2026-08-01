export interface ComponentIdEntry {
  id: string;
  version: string;
  preloadComponents?: string[];
}

export const SP_COMPONENT_IDS: Record<string, ComponentIdEntry> = {
  '@microsoft/sp-core-library': { id: '7263c7d0-1d6a-45ec-8d85-d4d1d234171b', version: '1.23.2' },
  '@microsoft/sp-loader': { id: '1c6c9123-7aac-41f3-a376-3caea41ed83f', version: '1.23.2' },
  '@microsoft/sp-webpart-base': {
    id: '974a7777-0990-4136-8fa6-95d80114c2e0',
    version: '1.23.2',
    preloadComponents: ['f9e737b7-f0df-4597-ba8c-3060f82380db']
  },
  '@microsoft/sp-component-base': { id: '467dc675-7cc5-4709-8aac-78e3b71bd2f6', version: '1.23.2' },
  '@microsoft/sp-property-pane': { id: 'f9e737b7-f0df-4597-ba8c-3060f82380db', version: '1.23.2' },
  '@microsoft/sp-page-context': { id: '1c4541f7-5c31-41aa-9fa8-fbc9dc14c0a8', version: '1.23.2' },
  '@microsoft/sp-http': { id: 'c07208f0-ea3b-4c1a-9965-ac1b825211a6', version: '1.23.2' },
  '@microsoft/sp-http-base': { id: '8496636c-2300-4915-abef-20de64c98d8b', version: '1.23.2' },
  '@microsoft/sp-diagnostics': { id: '78359e4b-07c2-43c6-8d0b-d060b4d577e8', version: '1.23.2' },
  '@microsoft/sp-dynamic-data': { id: 'e40f8203-b39d-425a-a957-714852e33b79', version: '1.23.2' },
  '@microsoft/load-themed-styles': { id: '229b8d08-79f3-438b-8c21-4613fc877abd', version: '0.1.2' },
  tslib: { id: '01c4df03-e775-48cb-aa14-171ee5199a15', version: '2.3.1' }
};
