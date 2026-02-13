import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import ModalDocumentView from "../ui/modal-document-view";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  document: any;
}

const InvoiceViewModal = ({
  isOpen,
  onClose,
  loading,
  document,
}: AlertModalProps) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  if (document.invoice_file_mimeType !== "application/pdf") {
    return (
      <ModalDocumentView isOpen={isOpen} onClose={onClose}>
        <div className="flex flex-col h-full ">
          This file can not be previewed.
          <div className="pt-6 space-x-2 flex items-center justify-end w-full ">
            <Button disabled={loading} variant={"outline"} onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </ModalDocumentView>
    );
  } else {
    const fileUrl = document.document_file_url || document.invoice_file_url;
    return (
      <ModalDocumentView isOpen={isOpen} onClose={onClose}>
        <div className="flex flex-col h-full ">
          {fileUrl ? (
            <embed
              style={{
                width: "100%",
                height: "100%",
              }}
              type="application/pdf"
              src={fileUrl}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No PDF file available to preview.
            </div>
          )}
          <div className="pt-6 space-x-2 flex items-center justify-end w-full ">
            <Button disabled={loading} variant={"outline"} onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </ModalDocumentView>
    );
  }
};

export default InvoiceViewModal;
