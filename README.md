# Control de Activos TI

Portal de GitHub Pages con autenticación, perfiles y ServiceDesk centralizados en Supabase.

## Preparación de producción

Requisitos: Node.js 20+, Supabase CLI mediante `npx supabase` y acceso administrativo al proyecto `jxknzmeqanrgxuqzbzut`.

1. Ejecutar en orden los scripts `supabase/01_auth_profiles.sql` a `supabase/10_enforce_mfa_on_sync.sql` desde Supabase SQL Editor. Realizar un respaldo previo.
2. Generar un valor aleatorio de al menos 32 bytes y configurar secretos sin guardarlos en Git:

```powershell
npx supabase secrets set CONTROLTI_RATE_LIMIT_SECRET="VALOR_ALEATORIO_LARGO" --project-ref jxknzmeqanrgxuqzbzut
npx supabase secrets set CONTROLTI_ALLOWED_ORIGINS="https://marioatf45-beep.github.io" --project-ref jxknzmeqanrgxuqzbzut
```

3. Desplegar las funciones antes de publicar el frontend:

```powershell
npx supabase login
npx supabase link --project-ref jxknzmeqanrgxuqzbzut
npx supabase functions deploy login-with-identifier --use-api
npx supabase functions deploy admin-manage-user --use-api
```

4. Publicar `main` mediante GitHub Pages.

## Pruebas posteriores

- Login con correo y usuario; rechazo y límite de credenciales incorrectas.
- Lectura de perfil y tickets con cada rol.
- Cambio administrativo de nombre, login, rol y contraseña.
- Desactivación, bloqueo de renovación de sesión y posterior reactivación.
- Consola y red sin respuestas 4xx/5xx inesperadas.

## Seguridad

La clave publicable del navegador no es secreta. Nunca agregar a Git una clave `service_role`, `sb_secret_...`, contraseñas, tokens o `CONTROLTI_RATE_LIMIT_SECRET`.
