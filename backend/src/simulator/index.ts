import 'dotenv/config';
import axios from 'axios';
import prisma from '../database/prisma';
import { MetricType } from '../types/domain';

const API_URL = process.env.SIMULATOR_API_URL || 'http://localhost:4000/api/telemetry';
const INTERVAL_MS = Number(process.env.SIMULATOR_INTERVAL_MS) || 1000;

interface DeviceState {
  id: string;
  name: string;
  /** Drift factors used to occasionally push devices into warning/critical. */
  tempBias: number;
  vibBias: number;
  /** Scenario timers for demo anomaly injection. */
  scenario: 'normal' | 'warming' | 'critical' | 'spike' | 'sensorFail';
  scenarioTicks: number;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/**
 * Generate a realistic reading for a metric given the device's current scenario.
 */
function generateValue(
  metric: MetricType,
  state: DeviceState
): number {
  switch (metric) {
    case MetricType.temperature: {
      if (state.scenario === 'sensorFail') return 0;
      if (state.scenario === 'spike') return round(rand(62, 72));
      if (state.scenario === 'critical') {
        return round(61 + state.tempBias + rand(0, 8));
      }
      if (state.scenario === 'warming') {
        // Gradual climb through warning into critical for trend detection
        const base = 40 + state.scenarioTicks * 2.2 + state.tempBias;
        return round(Math.min(base + rand(-0.3, 0.8), 68));
      }
      return round(rand(30, 45) + state.tempBias * 0.5);
    }
    case MetricType.vibration: {
      if (state.scenario === 'sensorFail') return 0;
      if (state.scenario === 'critical') return round(rand(2.6, 3.5));
      if (state.scenario === 'warming') return round(rand(1.6, 2.4));
      if (state.scenario === 'spike') return round(rand(2.8, 3.2));
      return round(rand(0.2, 1.5));
    }
    case MetricType.power:
      return round(rand(100, 300));
    case MetricType.pressure:
      return round(rand(40, 80));
    default:
      return 0;
  }
}

/** Occasionally switch devices into anomaly scenarios for demo purposes. */
function maybeAdvanceScenario(state: DeviceState): void {
  state.scenarioTicks += 1;

  if (state.scenario !== 'normal') {
    // End scenario after a few ticks
    const maxTicks =
      state.scenario === 'warming'
        ? 8
        : state.scenario === 'spike'
          ? 1
          : state.scenario === 'sensorFail'
            ? 6
            : 5;
    if (state.scenarioTicks >= maxTicks) {
      state.scenario = 'normal';
      state.scenarioTicks = 0;
    }
    return;
  }

  // ~3% chance per tick to enter a scenario
  const roll = Math.random();
  if (roll < 0.008) {
    state.scenario = 'critical';
    state.scenarioTicks = 0;
    console.log(`[sim] ${state.name} → critical scenario`);
  } else if (roll < 0.02) {
    state.scenario = 'warming';
    state.scenarioTicks = 0;
    console.log(`[sim] ${state.name} → warming trend scenario`);
  } else if (roll < 0.025) {
    state.scenario = 'spike';
    state.scenarioTicks = 0;
    console.log(`[sim] ${state.name} → isolated spike (should be filtered)`);
  } else if (roll < 0.028) {
    state.scenario = 'sensorFail';
    state.scenarioTicks = 0;
    console.log(`[sim] ${state.name} → sensor failure scenario`);
  }
}

async function postReading(
  deviceId: string,
  metric: MetricType,
  value: number
): Promise<void> {
  await axios.post(API_URL, {
    deviceId,
    metric,
    value,
    timestamp: new Date().toISOString(),
  });
}

async function tick(states: DeviceState[]): Promise<void> {
  const metrics = [
    MetricType.temperature,
    MetricType.vibration,
    MetricType.power,
    MetricType.pressure,
  ];

  for (const state of states) {
    maybeAdvanceScenario(state);
    for (const metric of metrics) {
      const value = generateValue(metric, state);
      try {
        await postReading(state.id, metric, value);
      } catch (err) {
        console.error(`[sim] Failed to post ${state.name}/${metric}:`, err);
      }
    }
  }
}

async function main(): Promise<void> {
  console.log(`[sim] Connecting to database to resolve device IDs...`);
  await prisma.$connect();

  const devices = await prisma.device.findMany({ orderBy: { name: 'asc' } });
  if (devices.length === 0) {
    console.error('[sim] No devices found. Start the API server first to seed the fleet.');
    process.exit(1);
  }

  const states: DeviceState[] = devices.map((d, i) => ({
    id: d.id,
    name: d.name,
    tempBias: (i - 2) * 0.4,
    vibBias: (i % 3) * 0.1,
    scenario: 'normal',
    scenarioTicks: 0,
  }));

  console.log(`[sim] Simulating ${states.length} devices → ${API_URL}`);
  console.log(`[sim] Interval: ${INTERVAL_MS}ms`);
  console.log(`[sim] Devices: ${states.map((s) => s.name).join(', ')}`);

  // Immediate first tick, then interval
  await tick(states);
  setInterval(() => {
    void tick(states);
  }, INTERVAL_MS);
}

main().catch((err) => {
  console.error('[sim] Fatal:', err);
  process.exit(1);
});
