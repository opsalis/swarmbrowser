import { JsonRpcProvider, Interface, id as keccakId } from 'ethers';

// Polls SwarmPlan PlanPurchased events and upgrades the in-memory keystore tier.
// Resumes from last seen block in /tmp/swarmplan-lastblock.
import { readFileSync, writeFileSync } from 'fs';

const RPC_URL = process.env.OPS_CHAIN_RPC || 'https://demo.chainrpc.net';
const SWARMPLAN_ADDRESS = process.env.SWARMPLAN_ADDRESS || '';
const POLL_MS = parseInt(process.env.INDEXER_POLL_MS || '10000');
const STATE_FILE = '/tmp/swarmplan-lastblock';

const iface = new Interface([
  'event PlanPurchased(bytes32 indexed keyHash, uint8 tier, address indexed payer, uint256 amountPaid, uint256 expiresAt)'
]);

const topic = keccakId('PlanPurchased(bytes32,uint8,address,uint256,uint256)');

export interface IndexerUpgradeFn {
  (keyHash: string, tier: 0 | 1 | 2, expiresAt: number): void;
}

export function startIndexer(upgrade: IndexerUpgradeFn): void {
  if (!SWARMPLAN_ADDRESS) {
    console.log('[indexer] SWARMPLAN_ADDRESS not set — skipping');
    return;
  }
  const provider = new JsonRpcProvider(RPC_URL);

  let lastBlock = 0;
  try { lastBlock = parseInt(readFileSync(STATE_FILE, 'utf8').trim()) || 0; } catch { /* cold start */ }

  async function tick() {
    try {
      const head = await provider.getBlockNumber();
      const from = lastBlock === 0 ? Math.max(0, head - 5000) : lastBlock + 1;
      if (from > head) return;
      const logs = await provider.getLogs({
        address: SWARMPLAN_ADDRESS,
        topics: [topic],
        fromBlock: from,
        toBlock: head,
      });
      for (const log of logs) {
        try {
          const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
          if (!parsed) continue;
          const keyHash = parsed.args.keyHash.toLowerCase();
          const tier = Number(parsed.args.tier) as 0 | 1 | 2;
          const expiresAt = Number(parsed.args.expiresAt);
          upgrade(keyHash, tier, expiresAt);
          console.log(`[indexer] upgraded ${keyHash} → tier ${tier} until ${new Date(expiresAt * 1000).toISOString()}`);
        } catch (e: any) {
          console.error('[indexer] parse error:', e.message);
        }
      }
      lastBlock = head;
      writeFileSync(STATE_FILE, String(head));
    } catch (e: any) {
      console.error('[indexer] poll error:', e.message);
    }
  }

  console.log(`[indexer] started: ${SWARMPLAN_ADDRESS} on ${RPC_URL}, poll ${POLL_MS}ms`);
  tick().catch(() => {});
  setInterval(() => { tick().catch(() => {}); }, POLL_MS);
}
