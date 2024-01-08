const fs = require('fs');

const originalFilePath = 'en_US.json';
const targetLanguages = ['id_ID', 'zh_CN', 'es_ES', 'fr_FR', 'ja_JP', 'ko_KR', 'ru_RU', 'th_TH', 'vi_VN'];

// Read the original file
let originalData = JSON.parse(fs.readFileSync(originalFilePath, 'utf8'));

// Sort keys alphabetically in the original file
originalData = Object.keys(originalData).sort().reduce((sortedData, key) => {
  sortedData[key] = originalData[key];
  return sortedData;
}, {});

// Iterate through target languages
targetLanguages.forEach((targetLanguage) => {
  const targetFilePath = `${targetLanguage}.json`;

  // Check if the target file exists
  if (fs.existsSync(targetFilePath)) {
    // Read the target file
    let targetData = JSON.parse(fs.readFileSync(targetFilePath, 'utf8'));

    // Merge and sort keys alphabetically
    const mergedData = { ...originalData, ...targetData };
    const sortedMergedData = Object.keys(mergedData).sort().reduce((sortedData, key) => {
      sortedData[key] = mergedData[key];
      return sortedData;
    }, {});

    // Add missing keys to the target file with default value and tag
    Object.keys(originalData).forEach((key) => {
      if (!targetData.hasOwnProperty(key)) {
        sortedMergedData[key] = `${originalData[key]} (EN)`;
      }
    });

    // Write the updated data back to the target file
    fs.writeFileSync(targetFilePath, JSON.stringify(sortedMergedData, null, 2), 'utf8');

    console.log(`Updated ${targetLanguage}.json`);
  } else {
    // If the target file doesn't exist, create it with default values from the original file
    const defaultData = {};
    Object.keys(originalData).forEach((key) => {
      defaultData[key] = `${originalData[key]} (EN)`;
    });

    // Write the default data to the new target file
    fs.writeFileSync(targetFilePath, JSON.stringify(defaultData, null, 2), 'utf8');

    console.log(`Created ${targetLanguage}.json with default values`);
  }
});

// Write the updated original data back to the original file
fs.writeFileSync(originalFilePath, JSON.stringify(originalData, null, 2), 'utf8');

console.log('Translation update complete.');