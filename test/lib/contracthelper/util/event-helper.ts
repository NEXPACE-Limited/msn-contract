import type { ContractFactory, Event } from "ethers";

type Log = Event;
type Interface = ContractFactory["interface"];

// noinspection JSUnusedLocalSymbols
export function checkEventMap<Map, T>(
  ...check: Record<T[keyof T][keyof T[keyof T]] & string, any> extends Map ? [] : [[never]]
) {}

export function genEventMap<F extends string, K extends F>(
  factories: Record<F, ContractFactory>,
  eventMap: Record<K, readonly string[]>
) {
  return Object.entries<readonly string[]>(eventMap).map(([k, v]) => ({
    iface: factories[k as K].interface,
    events: v!,
  }));
}

/**
 * @name EventHelper
 * @param iface - contract interface object
 * @typeParm Map - event name -> event type
 */
export default class EventHelper<Map = Record<string, Event>> {
  // eslint-disable-next-line no-useless-constructor
  constructor(arg: Interface | { iface: Interface; events: readonly string[] }[], inherit?: EventHelper<{}>) {
    this.ifaceMap = {
      ...inherit?.ifaceMap,
      ...Object.fromEntries(
        Array.isArray(arg)
          ? arg.flatMap(({ iface, events }) => events.map((x) => [x, iface]))
          : Object.values(arg.events).map((e) => [e.name, arg])
      ),
    } as this["ifaceMap"];
  }

  _map!: Map;

  readonly ifaceMap: Record<keyof Map, Interface>;

  parse<K extends keyof Map & string, T = Map[K]>(name: K, log: Log): T {
    return {
      ...log,
      args: this.ifaceMap[name].decodeEventLog(name, log.data, log.topics),
    } as unknown as T;
  }

  is<K extends keyof Map & string>(name: K, log: Log) {
    const iface = this.ifaceMap[name];
    return iface && iface.getEventTopic(name) === log.topics[0];
  }

  maybeParse<K extends keyof Map & string, T = Map[K]>(name: K, log: Log): T | null {
    if (!this.is(name, log)) return null;
    return this.parse(name, log);
  }

  findAndParse<K extends keyof Map & string, T = Map[K]>(name: K, logs: Log[]): T | null {
    const log = logs.find((x) => this.is(name, x));
    if (!log) return null;
    return this.parse(name, log);
  }

  filterAndParse<K extends keyof Map & string, T = Map[K]>(name: K, logs: Log[]): T[] {
    return logs.filter((x) => this.is(name, x)).map((x) => this.parse(name, x));
  }
}
