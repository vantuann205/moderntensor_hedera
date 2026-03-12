import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const execAsync = util.promisify(exec);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { reward, requester, code, language, subnet } = body;

        if (!reward || !requester || !code) {
            return NextResponse.json({ error: 'Missing required fields: reward, requester, code' }, { status: 400 });
        }

        const pythonPath = "C:\\Users\\NGO VAN TUAN\\AppData\\Local\\Programs\\Python\\Python312\\python.exe";
        const cwd = path.join(process.cwd(), '..');

        // Chuẩn bị file code tạm thời do code có thể chứa nhiều ký tự đặc biệt khó truyền qua command-line string
        const fs = require('fs');
        const tmpFilePath = path.join(cwd, 'tmp_task_code.txt');
        fs.writeFileSync(tmpFilePath, code);

        const command = `"${pythonPath}" api_inference.py --code "tmp_task_code.txt" --language ${language || 'solidity'} --requester ${requester} --reward ${reward}`;

        console.log(`[NextJS] Running API Inference Command: ${command}`);
        const { stdout: submitOut, stderr: submitErr } = await execAsync(command, { 
            cwd,
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });
        
        if (submitErr && !submitOut) {
            console.error(`[NextJS] Task Submit Error Output: ${submitErr}`);
        }

        // Parse JSON output from the script
        let inferenceResult = null;
        try {
            // Find the JSON block in stdout (in case there are other prints)
            const jsonStr = submitOut.substring(submitOut.indexOf('{'));
            inferenceResult = JSON.parse(jsonStr);
        } catch (e) {
            console.error(`[NextJS] Error parsing inference output: ${e}`);
            inferenceResult = { success: false, error: 'Invalid output from AI Engine', logs: submitOut };
        }

        // Sync real data lại ngay lập tức (không bắt buộc nhưng giúp list task mới)
        const syncCmd = `"${pythonPath}" sync_real_data.py`;
        console.log(`[NextJS] Running Sync Command: ${syncCmd}`);
        const { stdout: syncOut } = await execAsync(syncCmd, { 
            cwd,
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });

        // Cleanup
        try { fs.unlinkSync(tmpFilePath); } catch (e) {}

        if (inferenceResult && inferenceResult.success) {
            return NextResponse.json({ 
                success: true, 
                message: `Task computed and verified on Hedera!`, 
                data: inferenceResult.data,
                logs: syncOut 
            });
        } else {
            return NextResponse.json({ 
                error: inferenceResult?.error || 'Failed to process on-chain task submission', 
                logs: submitOut 
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error('[NextJS] Task Submit Exception:', error);
        return NextResponse.json({ 
            error: 'Failed to process on-chain task submission', 
            details: error.message 
        }, { status: 500 });
    }
}
