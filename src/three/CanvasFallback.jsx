import { Component } from 'react'

/**
 * Wraps any 3D canvas so a WebGL failure (old device, disabled GPU, headless
 * browser) degrades to a static poster instead of crashing the whole page.
 * Marketing pages must never show a raw error to a visitor.
 */
export default class CanvasFallback extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className={this.props.className || 'canvas-fallback'} aria-hidden="true">
          <div className="canvas-fallback-inner">
            <span className="canvas-fallback-mark">✈</span>
            {this.props.label && <span>{this.props.label}</span>}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
