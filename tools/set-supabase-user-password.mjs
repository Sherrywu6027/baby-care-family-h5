import { createClient } from '@supabase/supabase-js'

const projectUrl = process.env.SUPABASE_URL || 'https://aqyvyouyvyazuumwvryl.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const userId = process.env.SUPABASE_TARGET_USER_ID
const password = process.env.SUPABASE_TARGET_PASSWORD

if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

if (!userId) {
  console.error('Missing SUPABASE_TARGET_USER_ID')
  process.exit(1)
}

if (!password || password.length < 6) {
  console.error('Missing SUPABASE_TARGET_PASSWORD or password too short')
  process.exit(1)
}

const supabase = createClient(projectUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const { data, error } = await supabase.auth.admin.updateUserById(userId, {
  password
})

if (error) {
  console.error('Failed to update password:')
  console.error(error.message || error)
  process.exit(1)
}

console.log('Password updated successfully.')
console.log(JSON.stringify({
  user_id: data && data.user ? data.user.id : userId,
  email: data && data.user ? data.user.email : null
}, null, 2))
