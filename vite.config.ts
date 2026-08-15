import { cpSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * MediaPipe의 wasm 런타임을 node_modules에서 public/wasm으로 복사한다.
 *
 * 자산을 직접 호스팅해야 실행 중 외부(CDN) 요청이 사라지고, 그래야
 * "사진은 브라우저 안에서만 처리되고 어디에도 전송되지 않는다"는 고지가
 * 문자 그대로 참이 된다 (ADR-003, context.md §5).
 *
 * 복사본은 저장소에 커밋하지 않는다 — 패키지 버전과 어긋날 수 있어
 * 매 빌드마다 node_modules에서 새로 가져온다.
 */
function copyMediapipeWasm(): Plugin {
  return {
    name: 'copy-mediapipe-wasm',
    buildStart() {
      // 패키지가 package.json 하위 경로를 export하지 않아 resolve로는 찾을 수 없다.
      // 설치 위치를 직접 가리킨다.
      const source = resolve(
        import.meta.dirname,
        'node_modules/@mediapipe/tasks-vision/wasm',
      )

      if (!existsSync(source)) {
        throw new Error(`MediaPipe wasm 디렉토리를 찾지 못했다: ${source}`)
      }

      cpSync(source, resolve(import.meta.dirname, 'public/wasm'), { recursive: true })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 프로젝트 사이트 경로 (https://<user>.github.io/personal-color-hairstyle-app/)
  base: '/personal-color-hairstyle-app/',
  plugins: [react(), copyMediapipeWasm()],
})
