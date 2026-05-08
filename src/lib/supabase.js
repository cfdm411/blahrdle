import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gtinwalaewxjieusebrp.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_b8BPvUAzozq3GgYc-WUl_w_K70kADF4'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
