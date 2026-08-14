// Supabase Connection Test
async function testSupabaseConnection() {
  console.log("Starting Supabase connection test...");
  
  if (!supabaseClient) {
    console.error("Supabase client (supabaseClient) is not initialized. Connection test aborted.");
    return;
  }
  
  try {
    // Perform a lightweight request to check connection (e.g., retrieving system info or checking auth state)
    const { data, error } = await supabaseClient.auth.getSession();
    
    if (error) {
      console.error("Supabase connection failed during authentication session check:", error.message);
    } else {
      console.log("Supabase connection test passed! Session data:", data);
    }
  } catch (err) {
    console.error("Unexpected error during Supabase connection test:", err);
  }
}

// Run the connection test once the page is fully loaded
window.addEventListener('DOMContentLoaded', () => {
  // Give a small delay to ensure script initialization
  setTimeout(testSupabaseConnection, 1000);
});
