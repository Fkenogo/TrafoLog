const mongoose = require('mongoose');

class Database {
  constructor() {
    this.isConnected = false;
  }
  
  async connect() {
    if (this.isConnected) return;
    
    try {
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        minPoolSize: 2,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        serverSelectionTimeoutMS: 5000,
        heartbeatFrequencyMS: 10000
      };
      
      await mongoose.connect(process.env.MONGODB_URI, options);
      
      this.isConnected = true;
      console.log('MongoDB connected successfully');
      
      // Setup connection event listeners
      mongoose.connection.on('error', this.handleError);
      mongoose.connection.on('disconnected', this.handleDisconnect);
      
      // Create indexes
      await this.createIndexes();
      
    } catch (error) {
      console.error('MongoDB connection failed:', error);
      throw error;
    }
  }
  
  async disconnect() {
    if (!this.isConnected) return;
    
    await mongoose.disconnect();
    this.isConnected = false;
    console.log('MongoDB disconnected');
  }
  
  handleError(error) {
    console.error('MongoDB connection error:', error);
  }
  
  handleDisconnect() {
    console.log('MongoDB disconnected, attempting to reconnect...');
    // Auto-reconnection handled by mongoose
  }
  
  async createIndexes() {
    // Create all required indexes
    const collections = ['transformers', 'inspections', 'faults', 'users'];
    
    for (const collection of collections) {
      await mongoose.connection.db.collection(collection).createIndexes(
        this.getIndexesForCollection(collection)
      );
    }
  }
  
  getIndexesForCollection(collection) {
    const indexMap = {
      transformers: [
        { key: { asset_id: 1 }, unique: true },
        { key: { serial_number: 1 } },
        { key: { gps: '2dsphere' } },
        { key: { operational_status: 1, 'location_operational.territory_id': 1 } },
        { key: { network_voltage_kv: 1, kva_rating: 1 } },
        { key: { last_inspection_date: 1 } },
        { key: { has_open_fault: 1 } },
        { key: { created_at: -1 } }
      ],
      inspections: [
        { key: { transformer_id: 1, inspection_date: -1 } },
        { key: { inspector_id: 1 } },
        { key: { 'electrical.overload_flag': 1 } }
      ],
      faults: [
        { key: { transformer_id: 1, fault_date: -1 } },
        { key: { fault_status: 1 } },
        { key: { severity: 1 } },
        { key: { assigned_to: 1 } }
      ],
      users: [
        { key: { email: 1 }, unique: true },
        { key: { role: 1 } },
        { key: { territory_id: 1 } }
      ]
    };
    
    return indexMap[collection] || [];
  }
}

module.exports = new Database();