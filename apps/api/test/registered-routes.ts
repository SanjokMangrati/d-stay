import { INestApplication, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';

/**
 * The HTTP verbs supertest can be asked for, keyed by Nest's enum. A handler
 * decorated with anything else (`@All`, `@Options`) is skipped rather than
 * guessed at, and would need adding here before it could be checked.
 */
const VERB: Partial<Record<RequestMethod, Verb>> = {
  [RequestMethod.GET]: 'get',
  [RequestMethod.POST]: 'post',
  [RequestMethod.PUT]: 'put',
  [RequestMethod.DELETE]: 'delete',
  [RequestMethod.PATCH]: 'patch',
};

type Verb = 'get' | 'post' | 'put' | 'delete' | 'patch';

export interface RegisteredRoute {
  method: Verb;
  path: string;
}

/**
 * Every route the application actually registers, read from controller metadata
 * rather than listed by hand. Authorization tests iterate this so that adding an
 * endpoint without a guard fails a test instead of shipping unnoticed.
 */
export function registeredRoutes(app: INestApplication): RegisteredRoute[] {
  const discovery = app.get(DiscoveryService);
  const scanner = app.get(MetadataScanner);

  return discovery.getControllers().flatMap((wrapper) => {
    // `InstanceWrapper.instance` is typed `any`; narrowing it here is what keeps
    // the rest of this function honestly typed.
    const instance: unknown = wrapper.instance;
    if (typeof instance !== 'object' || instance === null) {
      return [];
    }
    const prototype = Object.getPrototypeOf(instance) as object;
    const basePath = metadataOf<string>(PATH_METADATA, instance.constructor);

    return scanner.getAllMethodNames(prototype).flatMap((methodName) => {
      const handler = (instance as Record<string, unknown>)[methodName];
      const requestMethod = metadataOf<RequestMethod>(METHOD_METADATA, handler);
      const verb =
        requestMethod === undefined ? undefined : VERB[requestMethod];
      if (!verb) {
        return [];
      }
      const methodPath = metadataOf<string>(PATH_METADATA, handler) ?? '';
      return [{ method: verb, path: join(basePath ?? '', methodPath) }];
    });
  });
}

function metadataOf<T>(key: string, target: unknown): T | undefined {
  return Reflect.getMetadata(key, target as object) as T | undefined;
}

function join(basePath: string, methodPath: string): string {
  const segments = [basePath, methodPath]
    .map((segment) => segment.replace(/^\/|\/$/g, ''))
    .filter((segment) => segment.length > 0);
  return `/${segments.join('/')}`;
}
