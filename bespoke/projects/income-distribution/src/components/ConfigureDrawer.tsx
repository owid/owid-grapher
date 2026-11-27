import { UNSAFE_PortalProvider } from "react-aria"
import {
    Button,
    Dialog,
    DialogTrigger,
    Modal,
    ModalOverlay,
} from "react-aria-components"
import { faPen, faXmark } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

const TITLE = "Configure the data"

/**
 * Narrow charts only: a button in place of the controls card, opening the
 * controls in a sheet at the bottom of the screen. Changes apply as they're
 * made, so the sheet stays open until dismissed.
 */
export function ConfigureDrawer({
    container,
    children,
}: {
    /**
     * Where the sheet mounts: an element inside the shadow root, so the
     * bundle's styles reach it
     */
    container: HTMLElement | null
    children: React.ReactNode
}): React.ReactElement {
    return (
        <DialogTrigger>
            <Button className="income-distribution-configure-button">
                <FontAwesomeIcon
                    icon={faPen}
                    className="income-distribution-configure-button__icon"
                />
                {TITLE}
            </Button>
            <UNSAFE_PortalProvider getContainer={() => container}>
                <ModalOverlay
                    className="income-distribution-configure-drawer"
                    isDismissable
                >
                    <Modal className="income-distribution-configure-drawer__sheet">
                        <Dialog
                            className="income-distribution-configure-drawer__dialog"
                            aria-label={TITLE}
                        >
                            {({ close }) => (
                                // Restore the default portal container for
                                // the controls' popovers, which mount in the
                                // light DOM (see IncomeUnitPicker.tsx)
                                <UNSAFE_PortalProvider getContainer={null}>
                                    <div className="income-distribution-configure-drawer__header">
                                        <span className="income-distribution-configure-drawer__title">
                                            {TITLE}
                                        </span>
                                        <Button
                                            className="income-distribution-configure-drawer__close"
                                            aria-label="Close"
                                            onPress={close}
                                        >
                                            <FontAwesomeIcon icon={faXmark} />
                                        </Button>
                                    </div>
                                    {children}
                                </UNSAFE_PortalProvider>
                            )}
                        </Dialog>
                    </Modal>
                </ModalOverlay>
            </UNSAFE_PortalProvider>
        </DialogTrigger>
    )
}
