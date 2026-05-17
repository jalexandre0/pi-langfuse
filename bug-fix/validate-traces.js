// validate-traces.js
// Usage: node validate-traces.js <BASE_URL> <PUBLIC_KEY> <SECRET_KEY> <UNIQUE_STRING_PREFIX>
// Examle: node validate-traces.js http://192.168.45.2:3100 pk-lf-... sk-lf-... TRACE-TEST

import https from 'https';

const BASE_URL = process.argv[2] || 'http://192.168.45.2:3100';
const PUBLIC_KEY = process.argv[3] || '';
const SECRET_KEY = process.argv[4] || '';
const PREFIX = process.argv[5] || 'TRACE-TEST';

const AUTH = Buffer.from(`${PUBLIC_KEY}:${SECRET_KEY}`).toString('base64');

async function fetchTraces() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: new URL(BASE_URL).hostname,
            port: new URL(BASE_URL).port || 80,
            path: '/api/public/traces?limit=100',
            method: 'GET',
            headers: {
                'Authorization': `Basic ${AUTH}`,
                'Content-Type': 'application/json'
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function main() {
    console.log(`Checking Langfuse at ${BASE_URL} for traces with prefix "${PREFIX}-XX"...`);
    
    try {
        const traces = await fetchTraces();
        const found = [];
        
        for (let i = 1; i <= 20; i++) {
            const target = `${PREFIX}-${String(i).padStart(2, '0')}`;
            const match = traces.data?.find(t => t.name?.includes(target) || t.input?.includes(target));
            if (match) {
                found.push(target);
                console.log(`✓ Found: ${target} (ID: ${match.id})`);
            } else {
                console.log(`❌ Missing: ${target}`);
            }
        }
        
        console.log(`\nResult: ${found.length}/20 traces found.`);
        if (found.length < 20) {
            console.log('The missing trace(s) might be hitting the syntax error in wrap* functions.');
        }
    } catch (error) {
        console.error('Error fetching traces:', error.message);
    }
}

main();
