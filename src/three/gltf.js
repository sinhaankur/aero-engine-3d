import { useGLTF } from '@react-three/drei'

/**
 * Point drei's GLTF loader at the Draco decoder we vendor in public/draco/.
 * All our aircraft/engine GLBs are Draco-compressed geometry (~80% smaller), so
 * they need a decoder; self-hosting it (not drei's gstatic CDN default) keeps
 * models decoding offline on the projector. Path respects the Vite base.
 *
 * This lives in the 3D layer (imported by the viewers) rather than the app entry
 * so it only pulls in three/drei when a 3D view actually loads — not on every
 * first paint. Runs once at module load; idempotent.
 */
useGLTF.setDecoderPath(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/draco/`)

export { useGLTF }
