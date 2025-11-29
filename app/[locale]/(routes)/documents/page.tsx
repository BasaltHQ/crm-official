import { getDocuments } from "@/actions/documents/get-documents";
import { getUnassignedDocuments } from "@/actions/documents/get-unassigned-documents";
import Container from "../components/ui/Container";
import { DocumentsDataTable } from "./components/data-table";
import { columns } from "./components/columns";
import ModalDropzone from "./components/modal-dropzone";
import { Documents } from "@prisma/client";
import { getDocumentsByBoardId } from "@/actions/documents/get-documents-by-boardId";

const DocumentsPage = async ({ searchParams }: { searchParams?: Promise<{ [k: string]: string | string[] | undefined }> }) => {
  const params = searchParams ? await searchParams : undefined;
  const boardIdParam = params?.boardId;
  const unassignedParam = params?.unassigned;
  let documents: Documents[];
  if (typeof unassignedParam === "string" && unassignedParam === "true") {
    documents = await getUnassignedDocuments();
  } else if (typeof boardIdParam === "string" && boardIdParam) {
    documents = await getDocumentsByBoardId(boardIdParam);
  } else {
    documents = await getDocuments();
  }

  if (!documents) {
    return <div>Something went wrong</div>;
  }

  return (
    <Container
      title="Documents"
      description={"Everything you need to know about company documents"}
    >
      <div className="flex space-x-5 py-5 items-center">
        <ModalDropzone buttonLabel="Upload pdf" fileType="pdfUploader" />
        <ModalDropzone buttonLabel="Upload images" fileType="imageUploader" />
        <ModalDropzone buttonLabel="Upload other files" fileType="docUploader" />
        <a href="?unassigned=true" className="text-xs text-muted-foreground underline">Show unassigned</a>
        <a href="?" className="text-xs text-muted-foreground underline">Show all</a>
      </div>

      {typeof boardIdParam === "string" && boardIdParam && (
        <div className="mb-3 text-xs text-muted-foreground">Filtering by project: {boardIdParam}</div>
      )}
      {typeof unassignedParam === "string" && unassignedParam === "true" && (
        <div className="mb-3 text-xs text-muted-foreground">Filtering: Unassigned documents</div>
      )}

      <DocumentsDataTable data={documents} columns={columns} />
    </Container>
  );
};

export default DocumentsPage;
