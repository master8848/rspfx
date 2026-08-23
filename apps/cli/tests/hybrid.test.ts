import fs from "node:fs";
import path from "node:path";
import { RspfxError } from "@mbsks/rspfx-diagnostics";
import { afterAll, describe, expect, it } from "vitest";
import { runDev } from "../src/commands/dev.js";
import {
  detectOfficialProject,
  loadConfigOrRefuseOfficial,
  loadOfficialConfig,
} from "../src/hybrid.js";
import { makeTmpDir, rmRf } from "./helpers.js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const dirs: string[] = [];

function makeProject(files: Record<string, string>): string {
  const dir = makeTmpDir("hybrid");
  dirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(dir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return dir;
}

const CONFIG_JSON = JSON.stringify({
  $schema:
    "https://developer.microsoft.com/json-schemas/spfx-build/config.1.0.schema.json",
  entries: [],
  localizedResources: {},
});
const GULPFILE =
  "'use strict'; const gulp = require('gulp'); gulp.task('default', done => done());";
const PACKAGE_JSON = JSON.stringify({
  name: "@contoso/hello-world",
  version: "2.3.4",
  dependencies: {
    "@microsoft/sp-core-library": "~1.20.2",
    "@microsoft/sp-webpart-base": "~1.20.2",
    react: "^17.0.1",
  },
});

afterAll(() => {
  for (const dir of dirs) {
    rmRf(dir);
  }
});

describe("detectOfficialProject", () => {
  it("detects an official project via toolchain markers", () => {
    for (const marker of ["gulpfile.js", "heft.json", ".yo-rc.json"]) {
      const dir = makeProject({
        "config/config.json": CONFIG_JSON,
        [marker]: "",
      });
      expect(detectOfficialProject(dir)).toEqual({ toolchainMarker: marker });
    }
  });

  it("is undefined without config/config.json", () => {
    const dir = makeProject({ "gulpfile.js": GULPFILE });
    expect(detectOfficialProject(dir)).toBeUndefined();
  });

  it("is undefined without a toolchain marker", () => {
    const dir = makeProject({ "config/config.json": CONFIG_JSON });
    expect(detectOfficialProject(dir)).toBeUndefined();
  });
});

describe("loadOfficialConfig", () => {
  function installed(
    projectFiles: Record<string, string>,
  ): Record<string, string> {
    return {
      "package.json": PACKAGE_JSON,
      "node_modules/@microsoft/sp-core-library/package.json": JSON.stringify({
        name: "@microsoft/sp-core-library",
        version: "1.20.2",
      }),
      ...projectFiles,
    };
  }

  it("derives identity fields from package.json dependencies", () => {
    const dir = makeProject(installed({}));
    const config = loadOfficialConfig(dir);
    expect(config.name).toBe("hello-world");
    expect(config.version).toBe("2.3.4");
    expect(config.spfxVersion).toBe("1.20");
    expect(config.framework).toBe("react");
  });

  it("falls back to vanilla without framework dependencies", () => {
    const dir = makeProject(
      installed({
        "package.json": JSON.stringify({
          name: "plain",
          version: "1.0.0",
          dependencies: { "@microsoft/sp-core-library": "~1.23.0" },
        }),
      }),
    );
    expect(loadOfficialConfig(dir).framework).toBe("vanilla");
  });

  it("rejects unsupported SPFx versions", () => {
    const dir = makeProject(
      installed({
        "package.json": JSON.stringify({
          name: "old",
          dependencies: { "@microsoft/sp-core-library": "~1.9.1" },
        }),
      }),
    );
    try {
      loadOfficialConfig(dir);
      throw new Error("expected OFFICIAL_SPFX_VERSION_UNSUPPORTED");
    } catch (error) {
      expect(error).toBeInstanceOf(RspfxError);
      expect((error as RspfxError).code).toBe(
        "OFFICIAL_SPFX_VERSION_UNSUPPORTED",
      );
    }
  });

  it("reports a missing sp-core-library dependency", () => {
    const dir = makeProject(
      installed({
        "package.json": JSON.stringify({ name: "not-spfx", version: "1.0.0" }),
      }),
    );
    try {
      loadOfficialConfig(dir);
      throw new Error("expected OFFICIAL_SPFX_VERSION_UNKNOWN");
    } catch (error) {
      expect(error).toBeInstanceOf(RspfxError);
      expect((error as RspfxError).code).toBe("OFFICIAL_SPFX_VERSION_UNKNOWN");
    }
  });

  it("requires installed @microsoft/sp-* packages", () => {
    const dir = makeProject({ "package.json": PACKAGE_JSON });
    expect(() => loadOfficialConfig(dir)).toThrowError(/not installed/);
  });
});

describe("loadConfigOrRefuseOfficial", () => {
  it("refuses production commands on official projects", async () => {
    const dir = makeProject({
      "config/config.json": CONFIG_JSON,
      "gulpfile.js": GULPFILE,
    });
    const error = await loadConfigOrRefuseOfficial(dir).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(RspfxError);
    expect((error as RspfxError).code).toBe("OFFICIAL_TOOLCHAIN_BUILD");
    expect((error as RspfxError).message).toContain("gulpfile.js");
  });

  it("keeps the original error for non-official projects", async () => {
    const dir = makeProject({});
    const error = await loadConfigOrRefuseOfficial(dir).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(RspfxError);
    expect((error as RspfxError).code).toBe("CONFIG_NOT_FOUND");
  });
});

describe("runDev on an official project (hybrid mode)", () => {
  // Workbench mode: sp-* stay externalized, so the synthetic fixture does not
  // need the full @fluentui/* tree that local-preview bundling would resolve.
  it(
    "synthesizes config and serves workbench debug manifests",
    { timeout: 120_000 },
    async () => {
      const dir = makeProject({
        "package.json": JSON.stringify({
          name: "hello-world",
          version: "1.0.0",
          dependencies: {
            "@microsoft/sp-core-library": "~1.20.2",
            "@microsoft/sp-webpart-base": "~1.20.2",
          },
        }),
        "gulpfile.js": GULPFILE,
        "config/config.json": JSON.stringify({
          $schema:
            "https://developer.microsoft.com/json-schemas/spfx-build/config.1.0.schema.json",
          entries: [
            {
              type: "webpart",
              entrypoint: "./src/webparts/hello/helloWebPart.ts",
              manifest: "./src/webparts/hello/hello.manifest.json",
            },
          ],
          localizedResources: {
            HelloWorldStrings: "lib/webparts/hello/loc/{locale}.js",
          },
        }),
        "config/serve.json": JSON.stringify({
          initialPage: "https://{tenantdomain}/_layouts/15/workbench.aspx",
          https: true,
          port: 4321,
          hostname: "localhost",
        }),
        "node_modules/@microsoft/sp-core-library/package.json":
          '{"name":"@microsoft/sp-core-library","version":"1.20.2"}',
        "node_modules/@microsoft/sp-core-library/dist/lc.manifest.json":
          JSON.stringify({
            id: "7263c7d0-1d6a-45ec-8d85-d4d1d234171b",
            alias: "SPCoreLibrary",
            componentType: "Library",
            version: "1.20.2",
            manifestVersion: 2,
            loaderConfig: {
              internalModuleBaseUrls: [],
              entryModuleId: "sp-core-library",
              scriptResources: {},
            },
          }),
        "node_modules/@microsoft/sp-webpart-base/package.json":
          '{"name":"@microsoft/sp-webpart-base","version":"1.20.2"}',
        "node_modules/@microsoft/sp-webpart-base/dist/wpb.manifest.json":
          JSON.stringify({
            id: "974a7777-0990-4136-8fa6-95d80114c2e0",
            alias: "SPWebPartBase",
            componentType: "Library",
            version: "1.20.2",
            manifestVersion: 2,
            loaderConfig: {
              internalModuleBaseUrls: [],
              entryModuleId: "sp-webpart-base",
              scriptResources: {},
            },
          }),
        "src/webparts/hello/hello.manifest.json": JSON.stringify({
          $schema:
            "https://developer.microsoft.com/json-schemas/spfx/client-side-web-part-manifest.schema.json",
          id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          alias: "HelloWorldWebPart",
          componentType: "WebPart",
          version: "*",
          manifestVersion: 2,
          safeWithCustomScriptDisabled: true,
          preconfiguredEntries: [
            {
              group: { default: "Other" },
              title: { default: "Hello World" },
              description: { default: "Hello world web part" },
              properties: { description: "hello" },
            },
          ],
        }),
        "src/webparts/hello/helloWebPart.ts": `export default class HelloWorldWebPart {
  public render(): void {
    this.domElement.innerHTML = '<p>Hello</p>';
  }
}
`,
      });

      const handle = await runDev(dir, {
        mode: "sharepoint",
        port: 0,
        tenant: "contoso.sharepoint.com",
      });
      try {
        expect(handle.workbenchUrl).toContain(
          "contoso.sharepoint.com/_layouts/15/workbench.aspx",
        );
        expect(handle.workbenchUrl).toContain("debug=true");
        expect(handle.workbenchUrl).toContain(
          `debugManifestsFile=${encodeURIComponent(`${handle.url}/temp/manifests.js`)}`,
        );

        const res = await fetch(`${handle.url}/temp/manifests.js`);
        expect(res.status).toBe(200);
        const body = await res.text();
        expect(body).toContain("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
        // sp-* debug manifests come from the project's own node_modules installs.
        expect(body).toContain("7263c7d0-1d6a-45ec-8d85-d4d1d234171b");
      } finally {
        await handle.close();
      }
    },
  );
});
