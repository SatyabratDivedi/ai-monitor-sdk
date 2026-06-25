import type { GovernXOneClient } from '../client';
import { BaseInstrumenter, InstrumenterOptions } from '../providers/base';

const PACKAGE = '@google/generative-ai';

export class GoogleInstrumenter extends BaseInstrumenter {
  readonly instrumenterName = PACKAGE;
  readonly provider = 'gemini' as const;

  tryPatch(client: GovernXOneClient, options?: InstrumenterOptions): boolean {
    let sdk: Record<string, unknown>;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      sdk = require(PACKAGE);
    } catch {
      return false;
    }

    const OrigClass = (sdk.GoogleGenerativeAI ?? sdk.default) as
      | (new (key: string) => {
          getGenerativeModel: (p: { model?: string }) => {
            generateContent: (input: unknown) => Promise<unknown>;
          };
        })
      | undefined;

    if (!OrigClass?.prototype) return false;

    const instrumenter = this;

    function PatchedGoogleGenerativeAI(this: unknown, ...args: unknown[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const instance = new (OrigClass as any)(...args);
      const origGetModel = instance.getGenerativeModel.bind(instance);

      instance.getGenerativeModel = (modelParams: { model?: string }) => {
        const model = origGetModel(modelParams);
        const origGenerate = model.generateContent.bind(model);

        model.generateContent = async (input: unknown) => {
          const started = Date.now();
          const modelName = modelParams?.model ?? 'unknown';
          const prompt = typeof input === 'string' ? input : JSON.stringify(input);

          try {
            const result = (await origGenerate(input)) as {
              response?: {
                text?: () => string;
                usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
              };
            };
            const response = result?.response?.text?.() ?? '';
            const usage = result?.response?.usageMetadata;
            instrumenter.trackInvocation(client, options, {
              model: modelName,
              prompt,
              response,
              inputTokens: usage?.promptTokenCount ?? 0,
              outputTokens: usage?.candidatesTokenCount ?? 0,
              latencyMs: Date.now() - started,
            });
            return result;
          } catch (err) {
            instrumenter.trackInvocation(client, options, {
              model: modelName,
              prompt,
              response: '',
              latencyMs: Date.now() - started,
              error: err instanceof Error ? err.message : String(err),
            });
            throw err;
          }
        };
        return model;
      };
      return instance;
    }

    PatchedGoogleGenerativeAI.prototype = OrigClass.prototype;
    sdk.GoogleGenerativeAI = PatchedGoogleGenerativeAI;
    if (sdk.default) {
      sdk.default = PatchedGoogleGenerativeAI;
    }

    return true;
  }
}
