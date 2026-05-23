// Supabase v2 returns { data, error } without throwing.
// On save failure in App.jsx, retry requires gameOver to flip false
// (new game) so savedRef resets — no in-session retry button yet.
export function throwIfSupabaseError({ error }) {
  if (error) throw error
}
