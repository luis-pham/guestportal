import type { ZodError, ZodTypeAny } from 'zod';
import {
  aiToolInputSchemas,
  aiToolOutputSchemas,
  aiToolScopeSchema,
  type AiToolName,
  type AiToolScope,
} from '@guestportal/contracts';

export type AiToolCode =
  | 'AI_TOOL_UNAUTHORIZED'
  | 'AI_TOOL_INPUT_INVALID'
  | 'AI_TOOL_OUTPUT_INVALID';

export class AiToolError extends Error {
  readonly code: AiToolCode;
  readonly statusCode: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: AiToolCode,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

type InputFor<Name extends AiToolName> = ReturnType<(typeof aiToolInputSchemas)[Name]['parse']>;
type OutputFor<Name extends AiToolName> = ReturnType<(typeof aiToolOutputSchemas)[Name]['parse']>;

export type AiToolHandler<Name extends AiToolName> = (
  input: InputFor<Name>,
  scope: AiToolScope,
) => Promise<unknown> | unknown;

export type AiToolDefinition<Name extends AiToolName = AiToolName> = {
  name: Name;
  mode: 'read_only' | 'draft_mutation';
  inputSchema: ZodTypeAny;
  outputSchema: ZodTypeAny;
  execute: AiToolHandler<Name>;
};

export type AiToolGateway = {
  execute<Name extends AiToolName>(input: {
    toolName: Name;
    input: unknown;
    scope: AiToolScope;
  }): Promise<OutputFor<Name>>;
};

function zodDetails(error: ZodError): Record<string, unknown> {
  return {
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
  };
}

function parseWithToolError<T>(
  schema: ZodTypeAny,
  value: unknown,
  code: AiToolCode,
  message: string,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AiToolError(
      code,
      message,
      code === 'AI_TOOL_OUTPUT_INVALID' ? 502 : 400,
      zodDetails(parsed.error),
    );
  }
  return parsed.data as T;
}

export function createAiToolGateway(
  definitions: Partial<{ [Name in AiToolName]: AiToolDefinition<Name> }>,
): AiToolGateway {
  return {
    async execute({ toolName, input, scope }) {
      const definition = definitions[toolName];
      if (!definition) {
        throw new AiToolError(
          'AI_TOOL_UNAUTHORIZED',
          'Tool is not authorized for this context.',
          403,
        );
      }

      const scoped = parseWithToolError<AiToolScope>(
        aiToolScopeSchema,
        scope,
        'AI_TOOL_UNAUTHORIZED',
        'Tool scope is invalid.',
      );
      const validatedInput = parseWithToolError<InputFor<typeof toolName>>(
        definition.inputSchema,
        input,
        'AI_TOOL_INPUT_INVALID',
        'Tool input is invalid.',
      );
      const rawOutput = await definition.execute(
        validatedInput as never,
        scoped,
      );
      return parseWithToolError<OutputFor<typeof toolName>>(
        definition.outputSchema,
        rawOutput,
        'AI_TOOL_OUTPUT_INVALID',
        'Tool output is invalid.',
      );
    },
  };
}

export function createGuestAiToolDefinitions(handlers: {
  searchKnowledge: AiToolHandler<'knowledge.search'>;
  readCatalog: AiToolHandler<'catalog.read'>;
  readServices: AiToolHandler<'service.read'>;
  draftRequest: AiToolHandler<'request.draft'>;
  draftOrder: AiToolHandler<'order.draft'>;
}): {
  [Name in AiToolName]: AiToolDefinition<Name>;
} {
  return {
    'knowledge.search': {
      name: 'knowledge.search',
      mode: 'read_only',
      inputSchema: aiToolInputSchemas['knowledge.search'],
      outputSchema: aiToolOutputSchemas['knowledge.search'],
      execute: handlers.searchKnowledge,
    },
    'catalog.read': {
      name: 'catalog.read',
      mode: 'read_only',
      inputSchema: aiToolInputSchemas['catalog.read'],
      outputSchema: aiToolOutputSchemas['catalog.read'],
      execute: handlers.readCatalog,
    },
    'service.read': {
      name: 'service.read',
      mode: 'read_only',
      inputSchema: aiToolInputSchemas['service.read'],
      outputSchema: aiToolOutputSchemas['service.read'],
      execute: handlers.readServices,
    },
    'request.draft': {
      name: 'request.draft',
      mode: 'draft_mutation',
      inputSchema: aiToolInputSchemas['request.draft'],
      outputSchema: aiToolOutputSchemas['request.draft'],
      execute: handlers.draftRequest,
    },
    'order.draft': {
      name: 'order.draft',
      mode: 'draft_mutation',
      inputSchema: aiToolInputSchemas['order.draft'],
      outputSchema: aiToolOutputSchemas['order.draft'],
      execute: handlers.draftOrder,
    },
  };
}
