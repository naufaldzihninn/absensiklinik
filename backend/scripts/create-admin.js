require('dotenv').config();

const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith('--')) continue;

        const key = arg.slice(2);
        const next = argv[i + 1];
        if (!next || next.startsWith('--')) {
            args[key] = true;
            continue;
        }

        args[key] = next;
        i += 1;
    }
    return args;
}

function usage() {
    console.log([
        'Usage:',
        '  npm run create-admin -- --username admin --password "strong-password" --name "Administrator"',
        '',
        'Options:',
        '  --username  Required. Login username.',
        '  --password  Required. Minimum 12 characters.',
        '  --name      Required. Full display name.',
        '  --force     Optional. Update existing user with the same username.'
    ].join('\n'));
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const username = String(args.username || '').trim().toLowerCase();
    const password = String(args.password || '');
    const name = String(args.name || '').trim();
    const force = Boolean(args.force);

    if (!username || !password || !name) {
        usage();
        process.exit(1);
    }

    if (password.length < 12) {
        console.error('Password admin minimal 12 karakter.');
        process.exit(1);
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('SUPABASE_URL dan SUPABASE_SERVICE_KEY harus diisi di .env.');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: existing, error: lookupError } = await supabase
        .from('pegawai')
        .select('id_pegawai')
        .eq('username', username)
        .maybeSingle();

    if (lookupError) throw lookupError;

    if (existing && !force) {
        console.error(`User "${username}" sudah ada. Tambahkan --force untuk update akun tersebut.`);
        process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const payload = {
        username,
        password: hashedPassword,
        nama_lengkap: name,
        role: 'admin',
        is_active: true
    };

    const query = existing
        ? supabase.from('pegawai').update(payload).eq('id_pegawai', existing.id_pegawai)
        : supabase.from('pegawai').insert(payload);

    const { data: user, error } = await query
        .select('id_pegawai, username, nama_lengkap, role, is_active')
        .single();

    if (error) throw error;

    await supabase.from('audit_log').insert({
        id_admin: user.id_pegawai,
        aksi: existing ? 'BOOTSTRAP_UPDATE_ADMIN' : 'BOOTSTRAP_CREATE_ADMIN',
        detail: { username: user.username }
    });

    console.log(`${existing ? 'Updated' : 'Created'} admin "${user.username}" (${user.nama_lengkap}).`);
}

main().catch(err => {
    console.error('Gagal membuat admin:', err.message);
    process.exit(1);
});
