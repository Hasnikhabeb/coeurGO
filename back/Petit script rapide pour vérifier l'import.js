import { supabase } from './lib/supabaseClient.js';

// On enferme bien le "await" dans une fonction "async"
async function checkDAE() {
  const { data, error, count } = await supabase
    .from('dae')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error("Erreur de lecture :", error);
  } else {
    console.log(`Succès ! Il y a maintenant ${count} DAE dans la base CoeurGO.`);
  }
}

// On lance la fonction
checkDAE();