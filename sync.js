const fs = require('fs');
const https = require('https');

const originalFilePath = 'en_US.json';
const targetLanguages = ['id_ID', 'zh_CN', 'es_ES', 'fr_FR', 'ja_JP', 'ko_KR', 'ru_RU', 'th_TH', 'vi_VN', "in_HI", "pl_PL" , "nl_NL", "pt_BR"];

// Read the original file
let originalData = JSON.parse(fs.readFileSync(originalFilePath, 'utf8'));

// Sort keys alphabetically in the original file
originalData = Object.keys(originalData).sort().reduce((sortedData, key) => {
    sortedData[key] = originalData[key];
    return sortedData;
}, {});

// Function to update target language file with translated values
async function updateTargetFile(targetLanguage) {
    const targetFilePath = `${targetLanguage}.json`;

    // Read the target file
    let targetData = {};

    if (fs.existsSync(targetFilePath)) {
        targetData = JSON.parse(fs.readFileSync(targetFilePath, 'utf8'));

        // Remove keys in the target file that are not present in the original file
        Object.keys(targetData).forEach((key) => {
            if (!originalData.hasOwnProperty(key)) {
                delete targetData[key];
            }
        });
    }

    // Merge and sort keys alphabetically
    const mergedData = { ...originalData, ...targetData };
    const sortedMergedData = Object.keys(mergedData).sort().reduce((sortedData, key) => {
        sortedData[key] = mergedData[key];
        return sortedData;
    }, {});

    // Add missing keys to the target file with default value and tag
    Object.keys(originalData).forEach((key) => {
        if (!targetData.hasOwnProperty(key)) {
            sortedMergedData[key] = `${originalData[key]}(EN)`;
        }
    });

    // Update target file with translated values
    for (const key of Object.keys(targetData)) {
        if (targetData[key].includes('(EN)')) {
            const untranslatedValue = targetData[key].replace('(EN)', '').trim();
            const translatedValue = await translateText(untranslatedValue, 'en', targetLanguage);
            sortedMergedData[key] = translatedValue + `(EAN)`;
        }
        
        if(originalData[key].includes(`(UTO)`)){
            const untranslatedValue = originalData[key].replace('(UTO)', '').trim();
            const translatedValue = await translateText(untranslatedValue, 'en', targetLanguage);
            sortedMergedData[key] = translatedValue + `(EAN)`;
        }
    }

    // Write the updated data back to the target file
    fs.writeFileSync(targetFilePath, JSON.stringify(sortedMergedData, null, 2), 'utf8');

    console.log(`Updated ${targetLanguage}.json with translated values`);
}

// Iterate through target languages and update files
(async () => {
    for (const targetLanguage of targetLanguages) {
        await updateTargetFile(targetLanguage);
    }

    // Write the updated original data back to the original file
    fs.writeFileSync(originalFilePath, JSON.stringify(originalData, null, 2), 'utf8');

    console.log('Translation update complete.');
})();

// Function to translate text using Google Translate API
async function translateText(text, fromLang, toLang) {
    if(toLang == "in_HI"){
        toLang = `hi` // idk why google
    }
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'translate.googleapis.com',
            path: `/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(text)}`,
            method: 'GET',
            headers: {
                'Accept': '*/*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:100.0) Gecko/20100101 Firefox/100.0',
            },
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.setEncoding('utf8'); // for JP N CN

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    let text = '';
                    parsedData[0].forEach(item => item[0] ? text += item[0] : '');
                    // const translatedText = parsedData[0][0][0];
                    resolve(text);
                } catch (error) {
                    //reject(error);
                    resolve(text);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}
