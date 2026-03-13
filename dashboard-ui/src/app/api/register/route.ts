import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const execAsync = util.promisify(exec);

const PYTHON = "C:\\Users\\NGO VAN TUAN\\AppData\\Local\\Programs\\Python\\Python312\\python.exe";
const ENV = { ...process.env, PYTHONIOENCODING: 'utf-8' };

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { type, id, stake, subnets = [1], capabilities = ['code_review'] } = body;

        if (!id || !stake) {
            return NextResponse.json({ error: 'Missing required fields: id, stake' }, { status: 400 });
        }

        const cwd = path.join(process.cwd(), '..');
        
        // Validator requires min 50,000 MDT stake (protocol rule)
        if (type === 'validator' && Number(stake) < 50000) {
            return NextResponse.json({
                error: `Validators must stake a minimum of 50,000 MDT. You provided: ${stake} MDT.`,
                hint: 'Increase your stake amount to at least 50,000 MDT to qualify as a Validator.'
            }, { status: 400 });
        }

        // Build command based on node type
        const command = type === 'validator'
            ? `"${PYTHON}" cli.py miner register ${id} --on-chain --stake ${stake} --subnet 1`  
            : `"${PYTHON}" cli.py miner register ${id} --on-chain --stake ${stake}`;
        
        console.log(`[NextJS] Register ${type}: ${command}`);
        const { stdout: regOut, stderr: regErr } = await execAsync(command, { cwd, env: ENV });
        if (regErr && !regOut) throw new Error(regErr);

        // Sync real data immediately
        const { stdout: syncOut } = await execAsync(`"${PYTHON}" sync_real_data.py`, { cwd, env: ENV });

        return NextResponse.json({ 
            success: true, 
            nodeType: type,
            nodeId: id,
            stake: Number(stake),
            message: `${type === 'validator' ? 'Validator' : 'Miner'} node ${id} registered on Hedera!`, 
            logs: regOut + '\n' + syncOut
        });

    } catch (error: any) {
        console.error('[NextJS] Registration Exception:', error);
        return NextResponse.json({ 
            error: 'Failed to process on-chain registration', 
            details: error.message 
        }, { status: 500 });
    }
}
