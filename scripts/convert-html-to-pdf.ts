const { spawn, exec } = require('child_process');
const FormData = require('form-data');
import axios from 'axios';
import { readFileSync, unlink, createReadStream } from 'fs';

const now = Date.now();
const cvPath = 'cv-new.html';
const output = 'public/CV-HaTienLoi.pdf';
const webpage = `${now}-cv-newhtml.webpage`;

async function sh(command, args) {
    const p = spawn(command, args);
    return new Promise((resolveFunc) => {
        p.stdout.on('data', (x) => {
            process.stdout.write(x.toString());
        });
        p.stderr.on('data', (x) => {
            process.stderr.write(x.toString());
        });
        p.on('exit', (code) => {
            resolveFunc(code);
        });
    });
}

const sleep = async (number: number) => {
    await new Promise((r) => setTimeout(r, number));
};

const createJob = async () => {
    const data = JSON.stringify({
        tasks: {
            import: {
                operation: 'import/upload',
            },
            convert: {
                operation: 'convert',
                input: 'import',
                input_format: 'webpage',
                output_format: 'pdf',
                options: {
                    page_size: 'a4',
                    page_orientation: 'portrait',
                    margin: '50',
                    initial_delay: '3',
                    hide_cookie: true,
                    use_print_stylesheet: true,
                },
                type: 'webpage',
            },
            'export-url': {
                operation: 'export/url',
                input: 'convert',
            },
        },
    });

    const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://api.freeconvert.com/v1/process/jobs',
        headers: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json',
            origin: 'https://www.freeconvert.com',
            referer: 'https://www.freeconvert.com/',
            'user-agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        },
        data,
    };
    try {
        const resp = await axios.request(config);
        const data = resp.data;
        const tasks = data.tasks;
        const importUploadJob = tasks[0];
        const jobId = importUploadJob.id;
        const formUrl = importUploadJob.result.form.url;
        const regex = /https?:\/\/server(\d+\-).*?com/;
        const serverUrl =
            regex.exec(formUrl)?.[0]?.toString()?.replace('server', 's') || '';
        const signature = importUploadJob.result.form.parameters.signature;
        const exportTask = tasks.find((v) => v.name === 'export-url');
        const exportId = exportTask.id;
        return { jobId, signature, serverUrl, exportId };
    } catch (error) {
        throw new Error(`createJob error: ${error}`);
    }
};

const resumableJob = async (jobId: string, serverUrl: string) => {
    let data = new FormData();
    data.append('resumableChunkNumber', '1');
    data.append('resumableType', 'text/html');
    data.append('resumableIdentifier', webpage);
    data.append('resumableFilename', cvPath);
    data.append('resumableRelativePath', cvPath);
    data.append('resumableTotalChunks', '1');
    data.append('file', createReadStream(cvPath));

    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${serverUrl}/api/resumable/${jobId}?resumableType=text%2Fhtml&resumableIdentifier=${webpage}&resumableFilename=cv-new.html&resumableRelativePath=cv-new.html&resumableTotalChunks=1`,
        headers: {
            origin: 'https://www.freeconvert.com',
            referer: 'https://www.freeconvert.com/',
            'user-agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            ...data.getHeaders(),
        },
        data,
    };
    try {
        const resp = await axios.request(config);
        const data = resp.data;
        if (data.fileUploadStatus !== 'done') {
            throw new Error('Failed to join. ');
        }
        console.log(data);
    } catch (error) {
        throw new Error(`resumableJob error: ${error}`);
    }
};

const joinJob = async (jobId: string, serverUrl: string) => {
    let data = new FormData();
    data.append('identifier', webpage);

    const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${serverUrl}/api/resumable/join/${jobId}`,
        headers: {
            origin: 'https://www.freeconvert.com',
            referer: 'https://www.freeconvert.com/',
            'user-agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            ...data.getHeaders(),
        },
        data: data,
    };
    try {
        const resp = await axios.request(config);
        const data = resp.data;
        console.log(data);
    } catch (error) {
        throw new Error(`joinJob error: ${error}`);
    }
};

const uploadFile = async (
    jobId: string,
    signature: string,
    serverUrl: string
) => {
    let data = new FormData();
    data.append('identifier', webpage);
    data.append('fileName', cvPath);
    data.append('signature', signature);
    const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${serverUrl}/api/upload/${jobId}`,
        headers: {
            origin: 'https://www.freeconvert.com',
            referer: 'https://www.freeconvert.com/',
            'user-agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            ...data.getHeaders(),
        },
        data,
    };
    try {
        const resp = await axios.request(config);
        const data = resp.data;
        if (data.msg !== 'ok') {
            throw new Error('Failed to uploadFile. ');
        }
        console.log(data);
    } catch (error) {
        throw new Error(`uploadFile error: ${error}`);
    }
};

const downloadFile = async (serverUrl: string, exportId: string) => {
    const url = `${serverUrl}/task/${exportId}/cv-new.pdf`;
    let config = {
        method: 'head',
        maxBodyLength: Infinity,
        url: url,
        headers: {},
    };
    let retry = 1;
    const maxRetry = 20;

    while (retry < maxRetry) {
        try {
            const resp = await axios.request(config);
            if (resp.status === 200) {
                await sh('curl', [url, '-o', output]);
                return;
            }
        } catch (error) {
            console.log(`Error download: ${error}`);
        }
        await sleep(1000);
        retry += 1;
    }
};

const main = async () => {
    const { jobId, signature, serverUrl, exportId } = await createJob();
    await sleep(2000);
    await resumableJob(jobId, serverUrl);
    await sleep(2000);
    await joinJob(jobId, serverUrl);
    await sleep(2000);
    await uploadFile(jobId, signature, serverUrl);
    await sleep(2000);
    await downloadFile(serverUrl, exportId);
};

main();
