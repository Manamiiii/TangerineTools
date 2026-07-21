import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('工具界面渲染失败：', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="empty-state app-error-state" role="alert">
        <strong>{this.props.title || '界面加载失败'}</strong>
        <span>{this.state.error?.message || '发生未知错误，请重新加载。'}</span>
        <button type="button" className="btn btn-primary" onClick={() => this.setState({ error: null })}>
          重新尝试
        </button>
      </div>
    )
  }
}
