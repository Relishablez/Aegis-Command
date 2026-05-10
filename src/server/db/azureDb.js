const { TableClient, AzureNamedKeyCredential } = require('@azure/data-tables');

// Connects to Azure Table Storage if environment variables are present.
// We use Table Storage because it's the simplest and cheapest option for a leaderboard.
const account = process.env.AZURE_STORAGE_ACCOUNT;
const accountKey = process.env.AZURE_STORAGE_ACCESS_KEY;
const tableName = 'AegisLeaderboard';

let client = null;

async function initDB() {
  if (account && accountKey) {
    const credential = new AzureNamedKeyCredential(account, accountKey);
    client = new TableClient(`https://${account}.table.core.windows.net`, tableName, credential);
    try {
      await client.createTable();
      console.log('Azure Table Storage initialized.');
      return true;
    } catch (e) {
      if (e.statusCode !== 409) { // 409 is table already exists
        console.error('Error creating Azure table:', e);
      } else {
        console.log('Azure Table Storage connected.');
        return true;
      }
    }
  }
  return false;
}

async function saveScore(entry) {
  if (!client) return;
  try {
    const entity = {
      partitionKey: 'Leaderboard',
      rowKey: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
      names: entry.names,
      waves: entry.waves,
      kills: entry.kills,
      timeSeconds: entry.timeSeconds,
      isCoop: entry.isCoop,
      playerCount: entry.playerCount,
      victory: entry.victory
    };
    await client.createEntity(entity);
  } catch (e) {
    console.error('Failed to save score to Azure:', e);
  }
}

async function getScores() {
  if (!client) return [];
  try {
    const scores = [];
    const iterator = client.listEntities({
      queryOptions: { filter: "PartitionKey eq 'Leaderboard'" }
    });
    for await (const entity of iterator) {
      if (scores.length >= 1000) break; // Limit to most recent/first 1000 to prevent startup hang
      scores.push({
        names: entity.names,
        waves: entity.waves,
        kills: entity.kills,
        timeSeconds: entity.timeSeconds,
        isCoop: entity.isCoop,
        playerCount: entity.playerCount,
        victory: entity.victory
      });
    }
    return scores;
  } catch (e) {
    console.error('Failed to fetch scores from Azure:', e);
    return [];
  }
}

module.exports = { initDB, saveScore, getScores };
