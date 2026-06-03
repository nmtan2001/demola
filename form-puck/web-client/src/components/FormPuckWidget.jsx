
import './FormPuckWidget.css';

const FormPuckWidget = ({ onClick, ledStates = ['off', 'off', 'off', 'off', 'off'] }) => {
    const safeStates = Array.from({ length: 5 }, (_, i) => ledStates[i] || 'off');

    return (
        <div className="form-puck-stage">
            <div className="mounting-clamp">
                <div className="clamp-joint">
                    <div className="clamp-pin"></div>
                </div>
                <div className="clamp-handle">
                    <div className="clamp-texture"></div>
                </div>
            </div>

            <div className="puck-device" onClick={onClick}>
                <div className="outer-bezel"></div>

                <div className="inner-core">

                    <svg className="engravings-layer" viewBox="0 0 400 400">
                        <g transform="translate(200, 200) rotate(0) translate(0, -123) scale(1.4)">
                            <circle cx="0" cy="-4" r="4.5" className="engraved-icon"/>
                            <path d="M -9 6 C -5 -1, 5 -1, 9 6" className="engraved-icon"/>
                        </g>

                        <g transform="translate(200, 200) rotate(72) translate(0, -123) scale(1.4)">
                            <path d="M -2 6 L 6 -2 L 0 -8" className="engraved-icon"/>
                            <path d="M 0 3 Q 4 -1 2 -5" className="engraved-icon"/>
                        </g>

                        <g transform="translate(200, 200) rotate(144) translate(0, -123) scale(1.4)">
                            <path d="M -2 6 L 5 -1 L 0 -8 L 4 -8" className="engraved-icon"/>
                        </g>

                        <g transform="translate(200, 200) rotate(-144) translate(0, -123) scale(1.4)">
                            <path d="M 2 6 L -5 -1 L 0 -8 L -4 -8" className="engraved-icon"/>
                        </g>

                        <g transform="translate(200, 200) rotate(-72) translate(0, -123) scale(1.4)">
                            <path d="M 2 6 L -6 -2 L 0 -8" className="engraved-icon"/>
                            <path d="M 0 3 Q -4 -1 -2 -5" className="engraved-icon"/>
                        </g>
                    </svg>

                    <svg className="led-ring-svg" viewBox="0 0 400 400">
                        <circle cx="200" cy="200" r="182" className="led-segment"
                                strokeDasharray="210 934" transform="rotate(-123 200 200)" data-state={safeStates[0]} />

                        <circle cx="200" cy="200" r="182" className="led-segment"
                                strokeDasharray="210 934" transform="rotate(-51 200 200)" data-state={safeStates[1]} />

                        <circle cx="200" cy="200" r="182" className="led-segment"
                                strokeDasharray="210 934" transform="rotate(21 200 200)" data-state={safeStates[2]} />

                        <circle cx="200" cy="200" r="182" className="led-segment"
                                strokeDasharray="210 934" transform="rotate(93 200 200)" data-state={safeStates[3]} />

                        <circle cx="200" cy="200" r="182" className="led-segment"
                                strokeDasharray="210 934" transform="rotate(165 200 200)" data-state={safeStates[4]} />
                    </svg>

                    <div className="camera-lens-assembly">
                        <div className="lens-recess">
                            <div className="lens-element-outer">
                                <div className="lens-element-inner">
                                    <div className="lens-glare-secondary"></div>
                                    <div className="lens-glare-primary"></div>
                                    <div className="aperture-core"></div>
                                    <div className="aperture-specular"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default FormPuckWidget;
