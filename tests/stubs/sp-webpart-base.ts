export class BaseClientSideWebPart<TProperties> {
  public properties: TProperties = {} as TProperties;
  public context: unknown;
  public domElement!: HTMLElement;
  public render(): void {}
  public onInit(): Promise<void> | void {}
  public onDispose(): void {}
  protected getPropertyPaneConfiguration(): unknown {
    return undefined;
  }
  protected get isRenderAsync(): boolean {
    return false;
  }
  _internalInitialize(ctx: { domElement: HTMLElement; manifest: unknown }): void {
    this.context = ctx;
    this.domElement = ctx.domElement;
  }
  _internalDeserialize(data: { properties: TProperties; dataVersion: string }): void {
    this.properties = data.properties;
  }
}
