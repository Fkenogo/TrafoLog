class LoadCalculator {
  /**
   * Calculate load percentage based on kVA rating and phase currents
   */
  calculateLoadPercentage(kvaRating, phaseA, phaseB, phaseC) {
    if (!phaseA && !phaseB && !phaseC) return 0;
    
    // Calculate average current
    const currents = [phaseA, phaseB, phaseC].filter(c => c !== undefined && c !== null);
    if (currents.length === 0) return 0;
    
    const avgCurrent = currents.reduce((a, b) => a + b, 0) / currents.length;
    
    // Estimate load in kVA (assuming 415V, 3-phase)
    // P = V * I * √3 / 1000
    const estimatedKVA = (415 * avgCurrent * 1.732) / 1000;
    
    // Calculate percentage
    const percentage = (estimatedKVA / kvaRating) * 100;
    
    return Math.round(Math.min(percentage, 100));
  }
  
  /**
   * Check if transformer is overloaded
   */
  isOverloaded(loadPercentage) {
    return loadPercentage > 90;
  }
}

module.exports = new LoadCalculator();