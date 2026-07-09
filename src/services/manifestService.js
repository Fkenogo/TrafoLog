const mongoose = require('mongoose');

const SCHEMA_VERSION = '1.0';

class ManifestService {
  async getMongoVersion() {
    try {
      const admin = mongoose.connection.db.admin();
      const info = await admin.serverInfo();
      return info.version || null;
    } catch (error) {
      return null;
    }
  }

  async getCollectionInventory(collectionNames = null) {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const allowedNames = new Set(collectionNames || []);
    const names = collections
      .map((collection) => collection.name)
      .filter((name) => !name.startsWith('system.'))
      .filter((name) => !collectionNames || allowedNames.has(name))
      .sort();

    return Promise.all(names.map(async (name) => ({
      name,
      document_count: await mongoose.connection.db.collection(name).countDocuments()
    })));
  }

  async buildManifest({ backupId, userId, collectionNames, checksum = null, compression = 'gzip', encryption = false }) {
    const packageJson = require('../../package.json');
    const collections = await this.getCollectionInventory(collectionNames);

    return {
      backup_id: backupId,
      timestamp: new Date().toISOString(),
      schema_version: SCHEMA_VERSION,
      app_version: packageJson.version,
      mongo_version: await this.getMongoVersion(),
      collections,
      document_counts: collections.reduce((acc, collection) => {
        acc[collection.name] = collection.document_count;
        return acc;
      }, {}),
      checksum,
      compression,
      encryption,
      created_by: userId.toString()
    };
  }

  async collectCollectionData(collections) {
    return Promise.all(collections.map(async (collection) => ({
      name: collection.name,
      documents: await mongoose.connection.db.collection(collection.name).find({}).toArray()
    })));
  }
}

module.exports = new ManifestService();
