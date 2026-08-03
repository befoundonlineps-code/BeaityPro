// Placeholder credentials so a module that builds the supabase client at
// import time can be loaded at all.
//
// Every lib/*IO.js imports the shared client, and createClient throws on an
// empty url — which meant none of them could be required from a test, and so
// none of them ever was. Nothing here reaches the network: the IO functions
// take a client parameter, and the tests pass their own recording stand-in.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_KEY ||= 'test-key-not-used-for-any-request'
