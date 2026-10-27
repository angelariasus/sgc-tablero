/**
 * Encabezados para llamar a Supabase con la clave de servicio.
 * Las claves nuevas (sb_secret_…) no son JWT: solo van en «apikey». Las heredadas (service_role, un JWT) van también como Bearer.
 */
export function serviceHeaders(key: string): Record<string, string> {
  return key.startsWith("sb_") ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
}
