const fs = require('fs');
const https = require('https');
const { URLSearchParams } = require('url');

/**
 * Language Translation Sync Tool
 * 
 * This script synchronizes translations across multiple language files using Google Translate API.
 * 
 * USAGE:
 *   node sync.js
 * 
 * REQUIREMENTS:
 *   - en_US.json file must exist in the same directory (source file)
 *   - Internet connection for Google Translate API
 * 
 * FEATURES:
 *   - Auto-translates missing keys tagged with (EN)
 *   - Updates untranslated keys tagged with (UTO) 
 *   - Removes obsolete keys not present in source file
 *   - Sorts all keys alphabetically
 *   - Supports 13 target languages
 * 
 * OUTPUT:
 *   - Creates/updates language files: id_ID.json, zh_CN.json, es_ES.json, etc.
 *   - Translated keys are tagged with (EAN) for tracking
 */

const CONFIG = {
    originalFile: 'en_US.json',
    targetLanguages: ['id_ID', 'zh_CN', 'es_ES', 'fr_FR', 'ja_JP', 'ko_KR', 'ru_RU', 'th_TH', 'vi_VN', 'in_HI', 'pl_PL', 'nl_NL', 'pt_BR'],
    tokenUrl: "https://translate.google.com",
    apiUrl: "https://translate.google.com/_/TranslateWebserverUi/data/batchexecute",
    tokenTTL: 3600000 // 1 hour
};

let token;

/**
 * Get authentication token from Google Translate
 */
async function getTokenV2() {
    if (token && token.time + CONFIG.tokenTTL > Date.now()) {
        return token;
    }

    return new Promise((resolve, reject) => {
        https.get(CONFIG.tokenUrl, res => {
            let html = '';
            res.setEncoding('utf8');
            res.on('data', chunk => html += chunk);
            res.on('end', () => {
                try {
                    const sid = html.match(/"FdrFJe":"(.*?)"/)[1];
                    const bl = html.match(/"cfb2h":"(.*?)"/)[1];
                    const at = html.match(/"SNlM0e":"(.*?)"/)?.[1] || "";
                    token = { sid, bl, at, time: Date.now() };
                    resolve(token);
                } catch (err) {
                    reject(new Error('Token extraction failed: ' + err));
                }
            });
        }).on('error', reject);
    });
}

/**
 * Request translation from Google Translate
 */
async function requestTranslate(text, sourceLang, targetLang) {
    const { sid, bl, at } = await getTokenV2();

    const req = JSON.stringify([
        [
            [
                "MkEWBc",
                JSON.stringify([[text, sourceLang, targetLang, true], [null]]),
                null,
                "generic",
            ],
        ],
    ]);

    const searchParams = new URLSearchParams({
        rpcids: "MkEWBc",
        "source-path": "/",
        "f.sid": sid,
        bl,
        hl: "ko",
        "soc-app": 1,
        "soc-platform": 1,
        "soc-device": 1,
        _reqid: Math.floor(10000 + 10000 * Math.random()),
        rt: "c",
    });

    const body = new URLSearchParams({ "f.req": req, at });

    const options = {
        hostname: 'translate.google.com',
        path: '/_/TranslateWebserverUi/data/batchexecute?' + searchParams.toString(),
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'Accept': '*/*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Referer': CONFIG.tokenUrl,
            'Origin': 'https://translate.google.com'
        }
    };

    return new Promise((resolve, reject) => {
        const httpReq = https.request(options, res => {
            let responseBody = '';
            res.setEncoding('utf8');
            res.on('data', chunk => responseBody += chunk);
            res.on('end', () => resolve(responseBody));
        });
        httpReq.on('error', reject);
        httpReq.write(body.toString());
        httpReq.end();
    });
}

/**
 * Parse Google Translate response and extract translated text
 */
function wrapResponse(res, text, sourceLang, targetLang) {
    try {
        const match = /\[.*\]/.exec(res);
        if (!match) return { targetText: text, detectedLang: sourceLang, transliteration: '' };

        const outerJson = JSON.parse(match[0]);
        if (!outerJson?.[0]?.[2]) return { targetText: text, detectedLang: sourceLang, transliteration: '' };

        const innerJson = JSON.parse(outerJson[0][2]);
        if (!innerJson?.[1]?.[0]?.[0]?.[5]) return { targetText: text, detectedLang: sourceLang, transliteration: '' };

        const sentences = innerJson[1][0][0][5];
        const targetText = sentences
            .map(sentence => sentence?.[0])
            .filter(Boolean)
            .join(" ");

        return {
            targetText: targetText || text,
            detectedLang: innerJson[0]?.[6]?.[2] || sourceLang,
            transliteration: innerJson[1][0][0][1] || '',
        };
    } catch (error) {
        console.error('Translation parse error:', error.message);
        return { targetText: text, detectedLang: sourceLang, transliteration: '' };
    }
}

/**
 * Translate text via Google Translate
 */
async function translate(text, sourceLang, targetLang) {
    if (targetLang === 'in_HI') targetLang = 'hi';

    try {
        const res = await requestTranslate(text, sourceLang, targetLang);
        return wrapResponse(res, text, sourceLang, targetLang);
    } catch (error) {
        console.error('Translation error:', error.message);
        return { targetText: text, detectedLang: sourceLang, transliteration: '' };
    }
}

// Export functions for testing
module.exports = { translate, getTokenV2, requestTranslate, wrapResponse };

// Only run main logic if this file is executed directly
if (require.main === module) {
    (async () => {
        // Read and sort the original file
        let originalData = JSON.parse(fs.readFileSync(CONFIG.originalFile, 'utf8'));
        originalData = Object.keys(originalData).sort().reduce((sortedData, key) => {
            sortedData[key] = originalData[key];
            return sortedData;
        }, {});

        // Process each target language
        for (const targetLanguage of CONFIG.targetLanguages) {
            const targetFilePath = `${targetLanguage}.json`;
            let targetData = {};

            // Read existing target file
            if (fs.existsSync(targetFilePath)) {
                try {
                    targetData = JSON.parse(fs.readFileSync(targetFilePath, 'utf8'));
                    // Remove obsolete keys
                    Object.keys(targetData).forEach(key => {
                        if (!originalData.hasOwnProperty(key)) {
                            delete targetData[key];
                        }
                    });
                } catch (error) {
                    console.log(`Error loading ${targetFilePath}:`, error.message);
                }
            }

            // Merge and sort keys
            const mergedData = { ...originalData, ...targetData };
            const sortedMergedData = Object.keys(mergedData).sort().reduce((sortedData, key) => {
                sortedData[key] = mergedData[key];
                return sortedData;
            }, {});

            // Add missing keys with (EN) tag
            Object.keys(originalData).forEach(key => {
                if (!targetData.hasOwnProperty(key)) {
                    sortedMergedData[key] = `${originalData[key]}(EN)`;
                }
            });

            // Translate tagged values
            for (const key of Object.keys(sortedMergedData)) {
                const value = sortedMergedData[key];
                
                // Translate (EN) tagged values
                if (value.includes('(EN)')) {
                    const untranslatedValue = value.replace('(EN)', '').trim();
                    const translatedResult = await translate(untranslatedValue, 'en', targetLanguage);
                    sortedMergedData[key] = translatedResult.targetText + '(EAN)';
                }
                
                // Translate (UTO) tagged values from original
                if (originalData[key]?.includes('(UTO)')) {
                    const untranslatedValue = originalData[key].replace('(UTO)', '').trim();
                    const translatedResult = await translate(untranslatedValue, 'en', targetLanguage);
                    sortedMergedData[key] = translatedResult.targetText + '(EAN)';
                }
            }

            // Write updated file
            fs.writeFileSync(targetFilePath, JSON.stringify(sortedMergedData, null, 2), 'utf8');
            console.log(`Updated ${targetLanguage}.json with translated values`);
        }

        // Write sorted original file
        fs.writeFileSync(CONFIG.originalFile, JSON.stringify(originalData, null, 2), 'utf8');
        console.log('Translation sync complete.');
    })();
}