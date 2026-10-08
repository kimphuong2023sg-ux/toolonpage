import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: '10px',
          padding: '24px',
          margin: '16px 0',
          color: '#f87171'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <strong style={{ fontSize: '15px', color: '#fca5a5' }}>
              {this.props.fallbackTitle || 'Đã xảy ra sự cố khi tải giao diện mục này'}
            </strong>
          </div>
          <p style={{ fontSize: '12.5px', color: '#cbd5e1', marginBottom: '14px', lineHeight: '1.5' }}>
            {this.state.error?.message || 'Lỗi không xác định.'}
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '12px', padding: '6px 14px', borderColor: 'rgba(239, 68, 68, 0.5)', color: '#fca5a5' }}
              onClick={this.handleReset}
            >
              🔄 Thử lại
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
