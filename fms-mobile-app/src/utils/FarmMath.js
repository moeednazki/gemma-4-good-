// Calculates estimated weight based on morphometric measurements (Metric)
export const calculateWeight = (girthCm, lengthCm, animalType = 'cow') => {
  const weight = (girthCm * girthCm * lengthCm) / 10840;
  return Math.round(weight);
};

// Calculates Target Dry Matter Intake (DMI) based on weight and yield
export const calculateDMI = (weightKg, milkYieldLiters, stage = 'milking') => {
  const dmi = (weightKg * 0.02) + (milkYieldLiters * 0.3);
  return parseFloat(dmi.toFixed(2));
};