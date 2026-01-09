import { ImageResponse } from 'next/og'
import OpengraphImage, { alt, size, contentType } from './opengraph-image'

export const runtime = 'edge'

export { alt, size, contentType }

export default async function Image() {
    return OpengraphImage()
}
